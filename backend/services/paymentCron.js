// ===== MoraJunto — Cron de Pagamentos Automatizados =====
const Rental = require('../models/Rental');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { getTierByName, creditAgentCommission } = require('./commissionService');
const asaas = require('./asaasService');
const emailService = require('./emailService');
const { currentMonthBR, currentDayBR } = require('../utils/textSearch');
const log = require('../utils/logger')('payment-cron');

const FEE_PERCENT = parseInt(process.env.FEE_PERCENT, 10) || 8;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Auto-gera PIX (Asaas → simulação dev) para uma transação e envia email com QR Code.
 */
async function autoGeneratePixForTx(tx, tenant, dueDate, month, propTitle) {
    var description = 'MoraJunto - Aluguel ' + month + ' - ' + propTitle;
    var dueStr = dueDate ? new Date(dueDate).toISOString().split('T')[0] : new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

    var savedTx = await PaymentTransaction.findById(tx._id);
    if (!savedTx) return;

    if (asaas.isConfigured()) {
        try {
            var customer;
            var tenantUser = await User.findById(tenant._id);
            if (!tenantUser) return;

            if (tenantUser.asaasCustomerId) {
                customer = { id: tenantUser.asaasCustomerId };
            } else {
                customer = await asaas.ensureCustomer(tenantUser.name, tenantUser.cpf || '', tenantUser.email);
                tenantUser.asaasCustomerId = customer.id;
                await tenantUser.save();
            }

            var charge = await asaas.createPixCharge(customer.id, savedTx.totalAmount, dueStr, description);
            var qr = await asaas.getPixQrCode(charge.id);

            savedTx.asaasPaymentId = charge.id;
            savedTx.asaasStatus = charge.status;
            savedTx.pixQrCode = qr.payload || '';
            savedTx.pixQrCodeBase64 = qr.encodedImage || '';
            await savedTx.save();

            emailService.sendPixPaymentEmail(
                tenantUser.email, tenantUser.name,
                savedTx.totalAmount, month, propTitle,
                savedTx.pixQrCode, savedTx.pixQrCodeBase64,
                dueDate
            );

            log.info('PIX Asaas gerado', { tenant: tenantUser.name, amount: savedTx.totalAmount });
            return;
        } catch (asaasErr) {
            log.error('Asaas PIX falhou', { tenant: tenant.name, message: asaasErr.message });
        }
    }

    // Simulação (dev)
    savedTx.mpStatus = 'simulation';
    savedTx.pixQrCode = 'MORAJUNTO' + savedTx._id.toString().substring(0, 8).toUpperCase();
    await savedTx.save();

    emailService.sendPaymentReminderEmail(
        tenant.email, tenant.name,
        savedTx.totalAmount, dueDate, propTitle
    );
}

/**
 * Auto-gerar cobranças mensais para todos os rentals ativos.
 * Roda diariamente; gera 5 dias antes do dueDay de cada rental.
 * Índice único {rental, month, tenant} garante idempotência (insertMany ordered=false tolera duplicatas).
 */
async function autoGenerateMonthlyCharges() {
    var currentMonth = currentMonthBR();
    var currentDay = currentDayBR();

    var rentals = await Rental.find({ status: 'active' })
        .populate('tenants', 'name email')
        .populate('property', 'title neighborhood agency');

    var generated = 0;

    for (var rental of rentals) {
        var dueDay = rental.dueDay || 10;
        var generateDay = Math.max(1, dueDay - 5);

        if (currentDay !== generateDay) continue;
        if (!rental.tenants || rental.tenants.length === 0) continue;

        var existing = await PaymentTransaction.findOne({ rental: rental._id, month: currentMonth });
        if (existing) continue;

        try {
            var owner = await User.findById(rental.owner);
            if (!owner) continue;

            var hasSplits = rental.tenantSplits && rental.tenantSplits.length > 0;
            var splitMap = {};
            if (hasSplits) {
                rental.tenantSplits.forEach(function(s) {
                    splitMap[s.tenant.toString()] = s.percentage;
                });
            }

            var property = rental.property;
            var agent = property && property.agency ? await User.findById(property.agency).select('agentProfile role') : null;
            var agentCommissionRate = 0;
            var agentId = null;
            if (agent && agent.role === 'agency') {
                agentId = agent._id;
                var agentTier = getTierByName(agent.agentProfile ? agent.agentProfile.tier : 'iniciante');
                agentCommissionRate = agentTier.rate;
            }

            var yearNum = parseInt(currentMonth.split('-')[0]);
            var monthNum = parseInt(currentMonth.split('-')[1]) - 1;
            var dueDate = new Date(yearNum, monthNum, Math.min(dueDay, 28));

            var txDocs = rental.tenants.map(function(tenant) {
                var tenantId = tenant._id.toString();
                var percentage = hasSplits && splitMap[tenantId]
                    ? splitMap[tenantId]
                    : (100 / rental.tenants.length);
                var rentForTenant = Math.round(rental.rentAmount * percentage / 100);
                var feeForTenant = Math.round(rentForTenant * FEE_PERCENT / 100);
                var totalForTenant = rentForTenant + feeForTenant;
                var agentCommissionAmount = Math.round(feeForTenant * agentCommissionRate);

                return {
                    rental: rental._id,
                    property: property._id,
                    tenant: tenant._id,
                    owner: rental.owner,
                    tenantName: tenant.name,
                    ownerName: owner.name,
                    month: currentMonth,
                    rentAmount: rentForTenant,
                    splitPercentage: percentage,
                    feePercent: FEE_PERCENT,
                    feeAmount: feeForTenant,
                    totalAmount: totalForTenant,
                    ownerReceives: rentForTenant,
                    dueDate: dueDate,
                    agentId: agentId,
                    agentCommission: agentCommissionAmount,
                    platformNet: feeForTenant - agentCommissionAmount,
                    status: 'pending'
                };
            });

            var savedTxs;
            try {
                savedTxs = await PaymentTransaction.insertMany(txDocs, { ordered: false });
            } catch (insertErr) {
                // Índice único { rental, month, tenant } pode gerar duplicate key — aceita e busca os docs existentes
                if (insertErr.code === 11000) {
                    log.warn('cobranças já existiam parcialmente, recuperando', { rental: rental._id, month: currentMonth });
                    savedTxs = await PaymentTransaction.find({ rental: rental._id, month: currentMonth });
                } else {
                    throw insertErr;
                }
            }
            generated += savedTxs.length;

            for (var i = 0; i < rental.tenants.length; i++) {
                var tenant = rental.tenants[i];
                var savedTx = savedTxs[i];
                if (!savedTx) continue;
                var propTitle = property ? property.title : 'seu imóvel';

                try {
                    await autoGeneratePixForTx(savedTx, tenant, dueDate, currentMonth, propTitle);
                } catch (pixErr) {
                    log.error('erro ao gerar PIX', { tenant: tenant.name, message: pixErr.message });
                }

                await Notification.create({
                    user: tenant._id,
                    type: 'payment_generated',
                    title: 'Aluguel gerado — pague via PIX',
                    message: 'Aluguel de R$' + savedTx.totalAmount.toFixed(2) + ' ref. ' + currentMonth + '. PIX já disponível no seu email!',
                    metadata: { rentalId: rental._id, month: currentMonth, paymentTransactionId: savedTx._id }
                });
            }

            await Notification.create({
                user: rental.owner,
                type: 'charges_generated',
                title: 'Cobranças geradas automaticamente',
                message: 'Cobranças + PIX de ' + currentMonth + ' foram gerados e enviados para ' + rental.tenants.length + ' inquilino(s).',
                metadata: { rentalId: rental._id, month: currentMonth }
            });
        } catch (e) {
            log.error('erro ao gerar cobranças para rental', { rental: rental._id, message: e.message });
        }
    }

    if (generated > 0) {
        log.info('cobranças geradas', { count: generated, month: currentMonth });
    }
}

/**
 * Realiza uma tentativa de repasse via Asaas. Retorna o objeto transfer ou lança erro.
 */
async function attemptTransfer(ownerTotal, owner, currentMonth) {
    return asaas.createTransfer(
        ownerTotal,
        owner.pixKey,
        owner.pixKeyType || 'aleatoria',
        'Repasse aluguel ' + currentMonth
    );
}

/**
 * Auto-repasse para proprietário via PIX após todos inquilinos pagarem.
 * Roda diariamente, verifica rentals onde todos pagaram no mês corrente.
 * Faz 1 retry no Asaas antes de marcar como falha.
 */
async function autoTransferToOwners() {
    var currentMonth = currentMonthBR();

    var rentals = await Rental.find({ status: 'active' });
    var transferred = 0;

    for (var rental of rentals) {
        if (!rental.tenants || rental.tenants.length === 0) continue;

        var txs = await PaymentTransaction.find({
            rental: rental._id,
            month: currentMonth
        });

        if (txs.length === 0) continue;

        var allPaid = txs.every(function(tx) { return tx.status === 'paid'; });
        if (!allPaid) continue;

        var alreadyTransferred = txs.some(function(tx) { return tx.ownerTransferStatus === 'transferred'; });
        if (alreadyTransferred) continue;

        var ownerTotal = txs.reduce(function(sum, tx) { return sum + tx.ownerReceives; }, 0);
        if (ownerTotal <= 0) continue;

        var owner = await User.findById(rental.owner);
        if (!owner) continue;

        if (!owner.pixKey) {
            log.warn('owner sem chave PIX, criando notificação', { owner: owner._id });
            try {
                // Evita spam: só notifica se não tiver notificação pendente desse tipo nas últimas 24h
                var recentNotif = await Notification.findOne({
                    user: owner._id,
                    type: 'pix_key_missing',
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });
                if (!recentNotif) {
                    await Notification.create({
                        user: owner._id,
                        type: 'pix_key_missing',
                        title: 'Configure sua chave PIX',
                        message: 'Seus inquilinos pagaram o aluguel de ' + currentMonth + ' (R$' + ownerTotal.toFixed(2) + '), mas não conseguimos repassar sem sua chave PIX. Configure em "Meu Perfil".',
                        metadata: { rentalId: rental._id, month: currentMonth, amount: ownerTotal }
                    });
                }
            } catch (notifErr) {
                log.error('erro ao criar notificação pix_key_missing', { message: notifErr.message });
            }
            continue;
        }

        if (!asaas.isConfigured()) {
            log.warn('Asaas não configurado, repasse manual necessário', { owner: rental.owner });
            continue;
        }

        var transfer = null;
        var lastErr = null;

        try {
            transfer = await attemptTransfer(ownerTotal, owner, currentMonth);
        } catch (e) {
            lastErr = e;
            log.warn('Asaas transfer falhou, fazendo 1 retry', { owner: owner._id, message: e.message });
            await new Promise(function(r) { setTimeout(r, 2000); });
            try {
                transfer = await attemptTransfer(ownerTotal, owner, currentMonth);
            } catch (e2) {
                lastErr = e2;
            }
        }

        if (!transfer) {
            log.error('Asaas transfer falhou após retry', { owner: owner._id, message: lastErr && lastErr.message });
            for (var txFail of txs) {
                txFail.ownerTransferStatus = 'failed';
                await txFail.save();
            }
            continue;
        }

        for (var tx of txs) {
            tx.ownerTransferStatus = 'transferred';
            tx.ownerTransferId = transfer.id || '';
            tx.ownerTransferredAt = new Date();
            await tx.save();
        }

        transferred++;

        await Notification.create({
            user: rental.owner,
            type: 'owner_transfer',
            title: 'Repasse realizado!',
            message: 'R$' + ownerTotal.toFixed(2) + ' foi transferido para sua conta via PIX ref. ' + currentMonth,
            metadata: { rentalId: rental._id, month: currentMonth, amount: ownerTotal }
        });

        emailService.sendOwnerTransferEmail(owner.email, owner.name, ownerTotal, currentMonth);

        log.info('repasse realizado', { owner: owner.name, amount: ownerTotal, month: currentMonth });
    }

    if (transferred > 0) {
        log.info('repasses concluídos', { count: transferred, month: currentMonth });
    }
}

module.exports = {
    autoGenerateMonthlyCharges: autoGenerateMonthlyCharges,
    autoTransferToOwners: autoTransferToOwners
};
