const express = require('express');
const router = express.Router();
const https = require('https');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Rental = require('../models/Rental');
const PaymentTransaction = require('../models/PaymentTransaction');
const authMiddleware = require('../middleware/auth');

const Property = require('../models/Property');
const { body, param, validationResult } = require('express-validator');
const { validateId } = require('../middleware/validateId');
const { getTierByName, creditAgentCommission } = require('../services/commissionService');
const { updatePaymentScore } = require('../services/scoreService');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const asaas = require('../services/asaasService');
const { generateContract } = require('../services/contractService');
const { autoTransferToOwners } = require('../services/paymentCron');
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const FEE_PERCENT = parseInt(process.env.FEE_PERCENT, 10) || 8;

// Rate limiter para endpoints de contrato (evitar abuso de geração de PDF)
const contractLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 15,
    message: { error: 'Muitas requisições de contrato. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ===== HELPER: Create PIX payment via Mercado Pago =====
function createMPPixPayment(amount, description, payerEmail, payerName, externalRef) {
    return new Promise((resolve, reject) => {
        if (!MP_TOKEN) {
            return reject(new Error('Mercado Pago não configurado'));
        }
        const body = JSON.stringify({
            transaction_amount: amount,
            description: description,
            payment_method_id: 'pix',
            payer: {
                email: payerEmail,
                first_name: payerName.split(' ')[0],
                last_name: payerName.split(' ').slice(1).join(' ') || payerName
            },
            external_reference: externalRef
        });

        const req = https.request({
            hostname: 'api.mercadopago.com',
            path: '/v1/payments',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + MP_TOKEN,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(parsed.message || 'Erro MP: ' + res.statusCode));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error('Erro ao processar resposta MP'));
                }
            });
        });
        req.on('error', reject);
        req.end(body);
    });
}

// ===== HELPER: Check MP payment status =====
function checkMPPayment(paymentId) {
    return new Promise((resolve, reject) => {
        if (!MP_TOKEN) return reject(new Error('MP não configurado'));
        const req = https.request({
            hostname: 'api.mercadopago.com',
            path: '/v1/payments/' + paymentId,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + MP_TOKEN }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ===== HELPER: Checar se todos pagaram e fazer repasse imediato =====
async function checkAndTransferToOwner(rentalId, month) {
    if (!rentalId || !month) return;

    var txs = await PaymentTransaction.find({ rental: rentalId, month: month });
    if (txs.length === 0) return;

    // Todos pagaram?
    var allPaid = txs.every(function(tx) { return tx.status === 'paid'; });
    if (!allPaid) return;

    // Já transferido?
    var alreadyTransferred = txs.some(function(tx) { return tx.ownerTransferStatus === 'transferred'; });
    if (alreadyTransferred) return;

    var ownerTotal = txs.reduce(function(sum, tx) { return sum + tx.ownerReceives; }, 0);
    if (ownerTotal <= 0) return;

    var owner = await User.findById(txs[0].owner);
    if (!owner || !owner.pixKey) {
        console.log('[AUTO-TRANSFER] Owner sem chave PIX — repasse pendente para cron');
        return;
    }

    if (!asaas.isConfigured()) return;

    var transfer = await asaas.createTransfer(
        ownerTotal,
        owner.pixKey,
        owner.pixKeyType || 'aleatoria',
        'Repasse aluguel ' + month
    );

    for (var tx of txs) {
        tx.ownerTransferStatus = 'transferred';
        tx.ownerTransferId = transfer.id || '';
        tx.ownerTransferredAt = new Date();
        await tx.save();
    }

    // Notificar
    await Notification.create({
        user: owner._id, type: 'owner_transfer',
        title: 'Repasse realizado!',
        message: 'Todos pagaram! R$' + ownerTotal.toFixed(2) + ' transferido via PIX ref. ' + month,
        metadata: { rentalId: rentalId, month: month, amount: ownerTotal }
    });
    emailService.sendOwnerTransferEmail(owner.email, owner.name, ownerTotal, month);
    console.log('[AUTO-TRANSFER] R$' + ownerTotal.toFixed(2) + ' repassado para ' + owner.name + ' (' + month + ')');
}

// ===== HELPER: Auto-gerar PIX ao criar cobrança =====
async function autoGeneratePixFromRoute(tx, tenant, dueDate, month, propertyObj) {
    var description = 'MoraJunto - Aluguel ' + month;
    var dueStr = dueDate ? new Date(dueDate).toISOString().split('T')[0] : new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    var propTitle = propertyObj && propertyObj.title ? propertyObj.title : 'seu imóvel';
    var savedTx = await PaymentTransaction.findById(tx._id);
    if (!savedTx) return;

    var tenantUser = await User.findById(tenant._id);
    if (!tenantUser) return;

    if (asaas.isConfigured()) {
        var customer;
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
        return;
    }

    // Simulação
    savedTx.mpStatus = 'simulation';
    savedTx.pixQrCode = 'MORAJUNTO' + savedTx._id.toString().substring(0, 8).toUpperCase();
    await savedTx.save();
    emailService.sendPaymentReminderEmail(tenantUser.email, tenantUser.name, savedTx.totalAmount, dueDate, propTitle);
}

// ===== POST /api/payments/generate — Proprietário gera cobranças do mês =====
router.post('/generate', authMiddleware, [
    body('rentalId').isMongoId().withMessage('ID de aluguel inválido'),
    body('month').optional().matches(/^\d{4}-\d{2}$/).withMessage('Formato de mês inválido (YYYY-MM)')
], async (req, res) => {
    try {
        var errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        var { rentalId, month } = req.body;
        if (!month) month = new Date().toISOString().substring(0, 7);

        var rental = await Rental.findById(rentalId)
            .populate('tenants', 'name email')
            .populate('property', 'title neighborhood');

        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });
        if (rental.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o proprietário pode gerar cobranças' });
        }

        if (!rental.tenants || rental.tenants.length === 0) {
            return res.status(400).json({ error: 'Nenhum inquilino vinculado a este aluguel' });
        }

        // Check if already generated
        var existing = await PaymentTransaction.findOne({ rental: rentalId, month: month });
        if (existing) return res.status(400).json({ error: 'Cobranças do mês ' + month + ' já foram geradas' });

        var owner = await User.findById(rental.owner);

        // Calcular split por inquilino (customizado ou igual)
        var hasSplits = rental.tenantSplits && rental.tenantSplits.length > 0;
        var splitMap = {};
        if (hasSplits) {
            rental.tenantSplits.forEach(function(s) {
                splitMap[s.tenant.toString()] = s.percentage;
            });
        }

        // Calculate agent commission from platform fee
        var property = await Property.findById(rental.property._id || rental.property).select('agency');
        var agent = property && property.agency ? await User.findById(property.agency).select('agentProfile role') : null;
        var agentCommissionRate = 0;
        var agentId = null;
        if (agent && agent.role === 'agency') {
            agentId = agent._id;
            var agentTier = getTierByName(agent.agentProfile ? agent.agentProfile.tier : 'iniciante');
            agentCommissionRate = agentTier.rate;
        }

        // Calculate due date (dueDay already capped at 28 by Rental schema)
        var dueDay = rental.dueDay || 10;
        var yearNum = parseInt(month.split('-')[0]);
        var monthNum = parseInt(month.split('-')[1]) - 1;
        var dueDate = new Date(yearNum, monthNum, Math.min(dueDay, 28));

        // Build all transaction docs and insert atomically
        var txDocs = rental.tenants.map(function(tenant) {
            // Calcular valor deste inquilino: split customizado ou igual
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
                property: rental.property._id,
                tenant: tenant._id,
                owner: rental.owner,
                tenantName: tenant.name,
                ownerName: owner ? owner.name : 'Proprietário',
                month: month,
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

        var transactions;
        try {
            transactions = await PaymentTransaction.insertMany(txDocs, { ordered: true });
        } catch (dupErr) {
            if (dupErr.code === 11000) {
                return res.status(400).json({ error: 'Cobranças do mês ' + month + ' já foram geradas' });
            }
            throw dupErr;
        }

        // Auto-gerar PIX para cada inquilino (em background, não bloqueia resposta)
        (async function() {
            for (var i = 0; i < rental.tenants.length; i++) {
                var tenant = rental.tenants[i];
                var savedTx = transactions[i];
                try {
                    await autoGeneratePixFromRoute(savedTx, tenant, dueDate, month, rental.property);
                } catch (pixErr) {
                    console.error('[GENERATE] Erro PIX para ' + tenant.name + ':', pixErr.message);
                }
            }
        })();

        var totalFees = txDocs.reduce(function(s, d) { return s + d.feeAmount; }, 0);
        res.json({
            message: 'Cobranças geradas para ' + month,
            transactions: transactions,
            splitType: hasSplits ? 'customizado' : 'igual',
            summary: {
                aluguelTotal: rental.rentAmount,
                inquilinos: rental.tenants.length,
                moraJuntoRecebe: totalFees,
                proprietarioRecebe: rental.rentAmount,
                detalhes: txDocs.map(function(d) {
                    return {
                        inquilino: d.tenantName,
                        porcentagem: d.splitPercentage,
                        aluguel: d.rentAmount,
                        taxa: d.feeAmount,
                        total: d.totalAmount
                    };
                })
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar cobranças' });
    }
});

// ===== POST /api/payments/:id/pix — Inquilino gera PIX pra pagar =====
router.post('/:id/pix', validateId('id'), authMiddleware, async (req, res) => {
    try {
        var tx = await PaymentTransaction.findById(req.params.id).populate('property', 'title');
        if (!tx) return res.status(404).json({ error: 'Cobrança não encontrada' });
        if (tx.tenant.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Esta cobrança não é sua' });
        }
        if (tx.status === 'paid') return res.status(400).json({ error: 'Já foi pago' });

        // Se já tem PIX gerado (Asaas ou MP), retornar o existente
        if (tx.asaasPaymentId && tx.pixQrCode) {
            return res.json({
                transactionId: tx._id,
                asaasPaymentId: tx.asaasPaymentId,
                qrCode: tx.pixQrCode,
                qrCodeBase64: tx.pixQrCodeBase64 || '',
                amount: tx.totalAmount,
                provider: 'asaas'
            });
        }

        var tenant = await User.findById(req.user.userId);
        var description = 'MoraJunto - Aluguel ' + tx.month;

        // ===== ASAAS (primário) =====
        if (asaas.isConfigured()) {
            try {
                // Garantir que inquilino tem customer no Asaas
                var customer;
                if (tenant.asaasCustomerId) {
                    customer = { id: tenant.asaasCustomerId };
                } else {
                    customer = await asaas.ensureCustomer(tenant.name, tenant.cpf || '', tenant.email);
                    tenant.asaasCustomerId = customer.id;
                    await tenant.save();
                }

                // Criar cobrança PIX
                var dueStr = tx.dueDate ? tx.dueDate.toISOString().split('T')[0] : new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
                var charge = await asaas.createPixCharge(customer.id, tx.totalAmount, dueStr, description);

                // Buscar QR Code
                var qr = await asaas.getPixQrCode(charge.id);

                tx.asaasPaymentId = charge.id;
                tx.asaasStatus = charge.status;
                tx.pixQrCode = qr.payload || '';
                tx.pixQrCodeBase64 = qr.encodedImage || '';
                await tx.save();

                return res.json({
                    transactionId: tx._id,
                    asaasPaymentId: charge.id,
                    qrCode: tx.pixQrCode,
                    qrCodeBase64: tx.pixQrCodeBase64,
                    amount: tx.totalAmount,
                    description: description,
                    provider: 'asaas'
                });
            } catch (asaasError) {
                console.error('[ASAAS] Erro ao gerar PIX:', asaasError.message);
                // Fall through to MP or simulation
            }
        }

        // ===== MERCADO PAGO (fallback) =====
        try {
            var mpResult = await createMPPixPayment(tx.totalAmount, description, tenant.email, tenant.name, tx._id.toString());
            var pix = mpResult.point_of_interaction && mpResult.point_of_interaction.transaction_data;
            tx.mpPaymentId = String(mpResult.id);
            tx.mpStatus = mpResult.status;
            tx.pixQrCode = pix ? pix.qr_code : '';
            tx.pixQrCodeBase64 = pix ? pix.qr_code_base64 : '';
            await tx.save();

            return res.json({
                transactionId: tx._id,
                mpPaymentId: mpResult.id,
                qrCode: tx.pixQrCode,
                qrCodeBase64: tx.pixQrCodeBase64,
                amount: tx.totalAmount,
                description: description,
                provider: 'mercadopago'
            });
        } catch (mpError) {
            // Simulation mode
            tx.mpStatus = 'simulation';
            await tx.save();
            return res.json({
                transactionId: tx._id,
                simulation: true,
                amount: tx.totalAmount,
                description: description,
                message: 'PIX em modo simulação.',
                pixCode: 'MORAJUNTO' + tx._id.toString().substring(0, 8).toUpperCase(),
                provider: 'simulation'
            });
        }
    } catch (e) {
        console.error('PIX generation error:', e.message);
        res.status(500).json({ error: 'Erro ao gerar PIX' });
    }
});

// ===== GET /api/payments/:id/status — Checar se PIX foi pago =====
router.get('/:id/status', validateId('id'), authMiddleware, async (req, res) => {
    try {
        var tx = await PaymentTransaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ error: 'Não encontrado' });

        // Only tenant or owner can check status
        if (tx.tenant.toString() !== req.user.userId && tx.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Sem permissão para ver esta cobrança' });
        }

        // Check Asaas status first
        if (tx.asaasPaymentId && tx.status !== 'paid') {
            try {
                var asaasResult = await asaas.getPaymentStatus(tx.asaasPaymentId);
                tx.asaasStatus = asaasResult.status;
                if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasResult.status)) {
                    tx.status = 'paid';
                    tx.paidAt = new Date();
                    await tx.save();
                    await creditAgentCommission(tx);
                    await updatePaymentScore(tx);
                    try { await checkAndTransferToOwner(tx.rental, tx.month); } catch (e) {}
                } else {
                    await tx.save();
                }
            } catch (e) { console.error('[STATUS] Asaas check failed:', e.message); }
        }
        // Fallback: check MP
        else if (tx.mpPaymentId && tx.mpStatus !== 'simulation' && MP_TOKEN && tx.status !== 'paid') {
            try {
                var mpResult = await checkMPPayment(tx.mpPaymentId);
                if (mpResult.status === 'approved' && tx.status !== 'paid') {
                    tx.status = 'paid';
                    tx.mpStatus = 'approved';
                    tx.paidAt = new Date();
                    await tx.save();
                    await creditAgentCommission(tx);
                    await updatePaymentScore(tx);
                    try { await checkAndTransferToOwner(tx.rental, tx.month); } catch (e) {}
                }
            } catch (e) { console.error('[STATUS] MP check failed:', e.message); }
        }

        res.json({
            status: tx.status,
            asaasStatus: tx.asaasStatus || null,
            mpStatus: tx.mpStatus || null,
            amount: tx.totalAmount,
            paidAt: tx.paidAt,
            provider: tx.asaasPaymentId ? 'asaas' : (tx.mpPaymentId ? 'mercadopago' : 'simulation')
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao checar status' });
    }
});

// ===== POST /api/payments/:id/confirm — Confirmar pagamento (apenas owner, apenas simulacao) =====
router.post('/:id/confirm', validateId('id'), authMiddleware, async (req, res) => {
    try {
        var tx = await PaymentTransaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ error: 'Não encontrado' });

        // Only owner can manually confirm
        if (tx.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o proprietário pode confirmar pagamento manualmente' });
        }

        if (tx.status === 'paid') return res.status(400).json({ error: 'Já foi pago' });

        // Only allow manual confirmation for simulation mode (non-production)
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Confirmação manual desabilitada em produção. Pagamentos são confirmados automaticamente via Mercado Pago.' });
        }
        if (tx.mpPaymentId && tx.mpStatus !== 'simulation') {
            return res.status(400).json({ error: 'Pagamento via PIX deve ser confirmado automaticamente pelo Mercado Pago' });
        }

        tx.status = 'paid';
        tx.paidAt = new Date();
        tx.mpStatus = 'manual_confirm';
        tx.confirmedBy = req.user.userId;
        await tx.save();
        await creditAgentCommission(tx);
        await updatePaymentScore(tx);

        // Notify tenant that payment was confirmed
        try {
            await Notification.create({
                user: tx.tenant, type: 'payment_confirmed',
                title: 'Pagamento confirmado',
                message: 'Seu pagamento de R$' + tx.totalAmount.toFixed(2) + ' ref. ' + tx.month + ' foi confirmado pelo proprietário.',
                metadata: { paymentTransactionId: tx._id, month: tx.month }
            });
        } catch (notifErr) { console.error('Notification error:', notifErr.message); }

        // Checar se todos pagaram → repasse imediato
        try { await checkAndTransferToOwner(tx.rental, tx.month); }
        catch (transferErr) { console.error('Manual confirm auto-transfer error:', transferErr.message); }

        res.json({
            message: 'Pagamento confirmado manualmente!',
            summary: {
                inquilinoPagou: tx.totalAmount,
                taxaMoraJunto: tx.feeAmount,
                proprietarioRecebe: tx.ownerReceives,
                mes: tx.month
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao confirmar' });
    }
});

// ===== GET /api/payments/contract/:rentalId — Gerar contrato PDF =====
router.get('/contract/:rentalId', contractLimiter, validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId)
            .populate('property')
            .populate('owner', 'name email cpf phone')
            .populate('tenants', 'name email cpf phone');

        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        // Only owner, tenant or admin can access
        var isOwner = rental.owner._id.toString() === req.user.userId;
        var isTenant = rental.tenants.some(function(t) { return t._id.toString() === req.user.userId; });
        var isAdmin = req.user.role === 'admin';
        if (!isOwner && !isTenant && !isAdmin) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        var pdfBuffer = await generateContract({
            owner: rental.owner,
            tenants: rental.tenants,
            property: rental.property,
            rental: {
                rentAmount: rental.rentAmount,
                platformFee: rental.platformFee * 100 || 8,
                startDate: rental.startDate,
                dueDay: rental.dueDay || 10
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=contrato-morajunto-' + rental._id.toString().substring(0, 8) + '.pdf');
        res.send(pdfBuffer);
    } catch (e) {
        console.error('Contract generation error:', e.message);
        res.status(500).json({ error: 'Erro ao gerar contrato' });
    }
});

// ===== POST /api/payments/contract/:rentalId/accept — Aceite digital do contrato =====
router.post('/contract/:rentalId/accept', contractLimiter, validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId);
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        var userId = req.user.userId;
        var isOwner = rental.owner.toString() === userId;
        var isTenant = rental.tenants.some(function(t) { return t.toString() === userId; });
        if (!isOwner && !isTenant) return res.status(403).json({ error: 'Sem permissão' });

        // Registrar aceite
        if (!rental.contractAcceptances) rental.contractAcceptances = [];
        var alreadyAccepted = rental.contractAcceptances.some(function(a) { return a.user.toString() === userId; });
        if (alreadyAccepted) return res.json({ message: 'Já aceito', accepted: true });

        rental.contractAcceptances.push({
            user: userId,
            role: isOwner ? 'owner' : 'tenant',
            acceptedAt: new Date(),
            ip: req.headers['x-forwarded-for'] || req.ip
        });
        await rental.save();

        // Verificar se todos aceitaram
        var totalParties = 1 + rental.tenants.length; // owner + tenants
        var allAccepted = rental.contractAcceptances.length >= totalParties;

        // Se todos aceitaram, enviar email para todas as partes
        if (allAccepted) {
            try {
                var fullRental = await Rental.findById(rental._id)
                    .populate('owner', 'name email')
                    .populate('tenants', 'name email')
                    .populate('property', 'title');
                if (fullRental) {
                    var propTitle = fullRental.property ? fullRental.property.title : 'Imóvel';
                    if (fullRental.owner.email) {
                        emailService.sendAllPartiesAcceptedEmail(fullRental.owner.email, fullRental.owner.name, propTitle);
                    }
                    fullRental.tenants.forEach(function(t) {
                        if (t.email) {
                            emailService.sendAllPartiesAcceptedEmail(t.email, t.name, propTitle);
                        }
                    });
                }
            } catch (emailErr) {
                console.error('Contract email notification error:', emailErr.message);
            }
        }

        res.json({
            message: 'Contrato aceito com sucesso',
            accepted: true,
            allPartiesAccepted: allAccepted,
            acceptedCount: rental.contractAcceptances.length,
            totalParties: totalParties
        });
    } catch (e) {
        console.error('Contract accept error:', e.message);
        res.status(500).json({ error: 'Erro ao registrar aceite' });
    }
});

// ===== GET /api/payments/contract/:rentalId/status — Status do aceite =====
router.get('/contract/:rentalId/status', contractLimiter, validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId)
            .populate('owner', 'name')
            .populate('tenants', 'name');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        var acceptances = rental.contractAcceptances || [];
        var totalParties = 1 + rental.tenants.length;
        var parties = [];

        // Owner
        var ownerAccepted = acceptances.find(function(a) { return a.user.toString() === rental.owner._id.toString(); });
        parties.push({ name: rental.owner.name, role: 'owner', accepted: !!ownerAccepted, acceptedAt: ownerAccepted ? ownerAccepted.acceptedAt : null });

        // Tenants
        rental.tenants.forEach(function(t) {
            var tenantAccepted = acceptances.find(function(a) { return a.user.toString() === t._id.toString(); });
            parties.push({ name: t.name, role: 'tenant', accepted: !!tenantAccepted, acceptedAt: tenantAccepted ? tenantAccepted.acceptedAt : null });
        });

        res.json({
            allAccepted: acceptances.length >= totalParties,
            parties: parties
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

// ===== POST /api/payments/contract/:rentalId/notify — Enviar contrato por email aos inquilinos =====
router.post('/contract/:rentalId/notify', contractLimiter, validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId)
            .populate('owner', 'name email')
            .populate('tenants', 'name email')
            .populate('property', 'title');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        // Only owner can notify
        if (rental.owner._id.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o proprietário pode enviar o contrato' });
        }

        var propTitle = rental.property ? rental.property.title : 'Imóvel';
        var sent = 0;
        for (var i = 0; i < rental.tenants.length; i++) {
            var t = rental.tenants[i];
            if (t.email) {
                await emailService.sendContractReadyEmail(t.email, t.name, rental.owner.name, propTitle, rental.rentAmount);
                sent++;
            }
        }

        res.json({ message: 'Contrato enviado para ' + sent + ' inquilino(s)', sent: sent });
    } catch (e) {
        console.error('Contract notify error:', e.message);
        res.status(500).json({ error: 'Erro ao notificar inquilinos' });
    }
});

// ===== POST /api/payments/webhook/asaas — Webhook Asaas =====
router.post('/webhook/asaas', express.json(), async (req, res) => {
    try {
        // Verificar assinatura do webhook Asaas (HMAC-SHA256)
        var asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
        if (asaasWebhookToken) {
            var asaasSignature = req.headers['asaas-access-token'];
            if (!asaasSignature || asaasSignature !== asaasWebhookToken) {
                console.error('[ASAAS] Webhook: token inválido ou ausente');
                return res.sendStatus(401);
            }
        } else if (process.env.NODE_ENV === 'production') {
            console.error('[ASAAS] Webhook: ASAAS_WEBHOOK_TOKEN não configurado em produção — rejeitando');
            return res.sendStatus(500);
        }

        var event = req.body;
        // Asaas envia: { event: "PAYMENT_RECEIVED", payment: { id, status, value, ... } }
        if (!event || !event.event || !event.payment) {
            return res.sendStatus(200);
        }

        var paymentId = event.payment.id;
        var status = event.payment.status;

        if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) {
            var tx = await PaymentTransaction.findOne({ asaasPaymentId: paymentId });
            if (tx && tx.status !== 'paid') {
                tx.status = 'paid';
                tx.asaasStatus = status;
                tx.paidAt = new Date();
                await tx.save();
                await creditAgentCommission(tx);
                await updatePaymentScore(tx);
                console.log('[ASAAS] Pagamento confirmado: R$' + tx.totalAmount + ' (taxa: R$' + tx.feeAmount + ')');

                // Notificações
                try {
                    await Notification.create({
                        user: tx.owner, type: 'payment_received',
                        title: 'Pagamento recebido',
                        message: tx.tenantName + ' pagou R$' + tx.ownerReceives.toFixed(2) + ' ref. ' + tx.month,
                        metadata: { paymentTransactionId: tx._id, rentalId: tx.rental, month: tx.month }
                    });
                    // Email pro inquilino
                    var tenantUser = await User.findById(tx.tenant);
                    if (tenantUser) {
                        emailService.sendPaymentConfirmedEmail(tenantUser.email, tenantUser.name, tx.totalAmount, 'Aluguel ref. ' + tx.month);
                    }
                } catch (notifErr) { console.error('Asaas webhook notification error:', notifErr.message); }

                // Checar se todos pagaram → repasse imediato ao proprietário
                try { await checkAndTransferToOwner(tx.rental, tx.month); }
                catch (transferErr) { console.error('[ASAAS] Auto-transfer error:', transferErr.message); }
            }
        }

        res.sendStatus(200);
    } catch (e) {
        console.error('[ASAAS] Webhook error:', e.message);
        res.sendStatus(500);
    }
});

// ===== POST /api/payments/webhook — Mercado Pago webhook =====

router.post('/webhook', express.json(), async (req, res) => {
    try {
        // Verify Mercado Pago webhook signature (REQUIRED)
        if (!process.env.MP_WEBHOOK_SECRET) {
            console.error('Webhook: MP_WEBHOOK_SECRET não configurado — rejeitando webhook');
            return res.sendStatus(500);
        }
        {
            var mpSignature = req.headers['x-signature'];
            var mpRequestId = req.headers['x-request-id'];
            if (!mpSignature || !mpRequestId) {
                return res.sendStatus(401);
            }
            var parts = {};
            mpSignature.split(',').forEach(function(p) {
                var kv = p.split('=');
                if (kv.length === 2) parts[kv[0].trim()] = kv[1].trim();
            });
            var dataId = req.body.data && req.body.data.id ? req.body.data.id : '';
            var manifest = 'id:' + dataId + ';request-id:' + mpRequestId + ';ts:' + (parts.ts || '') + ';';
            var hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
                .update(manifest).digest('hex');
            if (hmac !== parts.v1) {
                console.error('Webhook: assinatura invalida');
                return res.sendStatus(401);
            }
        }

        if (req.body.type === 'payment' && req.body.data && req.body.data.id) {
            var mpId = String(req.body.data.id);
            if (!MP_TOKEN) { res.sendStatus(200); return; }

            // MUST verify with MP API — never trust webhook body alone
            var mpResult;
            try {
                mpResult = await checkMPPayment(mpId);
            } catch (e) {
                console.error('Webhook: falha ao verificar pagamento no MP:', mpId);
                return res.sendStatus(500);
            }

            // Only process if MP confirms the payment exists and is approved
            if (!mpResult || !mpResult.id || !mpResult.status) {
                console.error('Webhook: resposta inválida do MP para:', mpId);
                return res.sendStatus(200);
            }

            // Match by external_reference (our tx ID) for extra safety
            var tx = mpResult.external_reference
                ? await PaymentTransaction.findById(mpResult.external_reference)
                : await PaymentTransaction.findOne({ mpPaymentId: mpId });

            if (tx && mpResult.status === 'approved' && tx.status !== 'paid') {
                tx.status = 'paid';
                tx.mpStatus = 'approved';
                tx.mpPaymentId = String(mpResult.id);
                tx.paidAt = new Date();
                await tx.save();
                await creditAgentCommission(tx);
                await updatePaymentScore(tx);
                console.log('💰 Pagamento confirmado via webhook: R$' + tx.totalAmount + ' (taxa: R$' + tx.feeAmount + ')');

                // Notify roommates + owner via Socket.io
                try {
                    var io = req.app.get('io');
                    var onlineUsers = req.app.get('onlineUsers');
                    if (io && tx.rental) {
                        var rental = await Rental.findById(tx.rental);
                        if (rental) {
                            var notifyIds = rental.tenants.map(function(t) { return t.toString(); });
                            notifyIds.push(rental.owner.toString());
                            notifyIds.forEach(function(uid) {
                                var socketId = onlineUsers.get(uid);
                                if (socketId) {
                                    io.to(socketId).emit('payment-update', {
                                        rentalId: tx.rental,
                                        tenantId: tx.tenant,
                                        tenantName: tx.tenantName,
                                        month: tx.month,
                                        status: 'paid'
                                    });
                                }
                            });
                        }
                    }
                    // Create notifications
                    await Notification.create({
                        user: tx.owner, type: 'payment_received',
                        title: 'Pagamento recebido',
                        message: tx.tenantName + ' pagou R$' + tx.ownerReceives.toFixed(2) + ' ref. ' + tx.month,
                        metadata: { paymentTransactionId: tx._id, rentalId: tx.rental, month: tx.month }
                    });
                    if (tx.rental) {
                        var rentalForNotif = await Rental.findById(tx.rental);
                        if (rentalForNotif) {
                            for (var tid of rentalForNotif.tenants) {
                                if (tid.toString() !== tx.tenant.toString()) {
                                    await Notification.create({
                                        user: tid, type: 'roommate_paid',
                                        title: 'Roommate pagou',
                                        message: tx.tenantName + ' pagou a parte dele(a) de ' + tx.month,
                                        metadata: { rentalId: tx.rental, month: tx.month }
                                    });
                                }
                            }
                        }
                    }
                    // Enviar email de confirmação para o inquilino
                    try {
                        var tenantUser = await User.findById(tx.tenant);
                        var property = tx.rental ? await Rental.findById(tx.rental).then(r => r && Property.findById(r.property)) : null;
                        if (tenantUser) {
                            emailService.sendPaymentConfirmedEmail(
                                tenantUser.email,
                                tenantUser.name,
                                tx.totalAmount,
                                property ? property.title : 'Aluguel ref. ' + tx.month
                            );
                        }
                    } catch (emailErr) { console.error('Payment email error:', emailErr.message); }
                } catch (notifErr) { console.error('Notification error:', notifErr.message); }

                // Checar se todos pagaram → repasse imediato ao proprietário
                try { await checkAndTransferToOwner(tx.rental, tx.month); }
                catch (transferErr) { console.error('[MP] Auto-transfer error:', transferErr.message); }
            }
        }
        res.sendStatus(200);
    } catch (e) {
        console.error('Webhook error:', e.message);
        res.sendStatus(500);
    }
});

// ===== GET /api/payments/tenant — Pagamentos do inquilino =====
router.get('/tenant', authMiddleware, async (req, res) => {
    try {
        var transactions = await PaymentTransaction.find({ tenant: req.user.userId })
            .populate('property', 'title neighborhood')
            .sort({ month: -1, createdAt: -1 });
        res.json({ transactions });
    } catch (e) {
        res.json({ transactions: [] });
    }
});

// ===== GET /api/payments/owner — Pagamentos do proprietário =====
router.get('/owner', authMiddleware, async (req, res) => {
    try {
        var transactions = await PaymentTransaction.find({ owner: req.user.userId })
            .populate('property', 'title neighborhood')
            .populate('tenant', 'name')
            .sort({ month: -1, createdAt: -1 });

        // Calculate totals
        var totalReceived = 0;
        var totalPending = 0;
        var platformFees = 0;
        transactions.forEach(function(tx) {
            if (tx.status === 'paid') {
                totalReceived += tx.ownerReceives;
                platformFees += tx.feeAmount;
            } else {
                totalPending += tx.ownerReceives;
            }
        });

        res.json({
            transactions,
            summary: {
                totalReceived,
                totalPending,
                platformFees,
                transactionCount: transactions.length
            }
        });
    } catch (e) {
        res.json({ transactions: [], summary: { totalReceived: 0, totalPending: 0, platformFees: 0 } });
    }
});

// ===== GET /api/payments/admin/dashboard — Dashboard financeiro admin =====
router.get('/admin/dashboard', authMiddleware, async (req, res) => {
    try {
        var user = await User.findById(req.user.userId);
        if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

        var allTx = await PaymentTransaction.find().limit(500).sort({ createdAt: -1 });
        var totalCollected = 0;
        var totalFees = 0;
        var totalPending = 0;
        var paidCount = 0;

        allTx.forEach(function(tx) {
            if (tx.status === 'paid') {
                totalCollected += tx.totalAmount;
                totalFees += tx.feeAmount;
                paidCount++;
            } else {
                totalPending += tx.totalAmount;
            }
        });

        res.json({
            totalCollected,
            totalFees, // ← esse é o lucro do MoraJunto
            totalPending,
            totalTransactions: allTx.length,
            paidTransactions: paidCount,
            averageFee: paidCount > 0 ? Math.round(totalFees / paidCount) : 0
        });
    } catch (e) {
        res.json({ totalCollected: 0, totalFees: 0, totalPending: 0 });
    }
});

// ===== GET /api/payments/rental/:rentalId/status — Painel de transparência =====
router.get('/rental/:rentalId/status', validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId)
            .populate('tenants', 'name profilePhoto paymentScore');

        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        // Only tenants or owner can view
        var userId = req.user.userId;
        var isTenant = rental.tenants.some(function(t) { return t._id.toString() === userId; });
        var isOwner = rental.owner.toString() === userId;
        if (!isTenant && !isOwner) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        var month = req.query.month || new Date().toISOString().substring(0, 7);

        var transactions = await PaymentTransaction.find({
            rental: req.params.rentalId,
            month: month
        });

        var totalExpected = 0;
        var totalReceived = 0;

        var tenants = rental.tenants.map(function(t) {
            var tx = transactions.find(function(tr) { return tr.tenant.toString() === t._id.toString(); });
            var amount = tx ? tx.totalAmount : 0;
            var ownerAmount = tx ? tx.ownerReceives : 0;
            totalExpected += amount;
            if (tx && tx.status === 'paid') totalReceived += amount;
            return {
                tenantId: t._id,
                name: t.name,
                photo: t.profilePhoto || '',
                badge: t.paymentScore ? t.paymentScore.badge : 'none',
                score: t.paymentScore ? t.paymentScore.score : 0,
                amount: amount,
                ownerReceives: ownerAmount,
                status: tx ? tx.status : 'not_generated',
                dueDate: tx ? tx.dueDate : null,
                paidAt: tx ? tx.paidAt : null,
                transactionId: tx ? tx._id : null
            };
        });

        res.json({
            month: month,
            rentAmount: rental.rentAmount,
            dueDay: rental.dueDay || 10,
            tenants: tenants,
            summary: {
                totalExpected: totalExpected,
                totalReceived: totalReceived,
                totalPending: totalExpected - totalReceived,
                paidCount: tenants.filter(function(t) { return t.status === 'paid'; }).length,
                totalCount: tenants.length
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

// ===== GET /api/payments/:id/receipt — Recibo digital =====
router.get('/:id/receipt', validateId('id'), authMiddleware, async (req, res) => {
    try {
        var tx = await PaymentTransaction.findById(req.params.id)
            .populate('tenant', 'name cpf')
            .populate('owner', 'name')
            .populate('property', 'title address neighborhood');

        if (!tx) return res.status(404).json({ error: 'Não encontrado' });
        if (tx.status !== 'paid') return res.status(400).json({ error: 'Pagamento ainda não foi confirmado' });

        // Only tenant or owner
        if (tx.tenant._id.toString() !== req.user.userId && tx.owner._id.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        // Mask CPF
        var cpf = tx.tenant.cpf || '';
        var maskedCpf = cpf.length >= 11 ? '***.' + cpf.substring(3, 6) + '.' + cpf.substring(6, 9) + '-' + cpf.substring(9) : '***';

        var monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        var parts = tx.month.split('-');
        var monthLabel = monthNames[parseInt(parts[1]) - 1] + '/' + parts[0];

        res.json({
            receiptNumber: 'MJ-' + tx.month + '-' + tx._id.toString().substring(18),
            date: tx.paidAt.toISOString().substring(0, 10),
            tenant: { name: tx.tenant.name, cpf: maskedCpf },
            owner: { name: tx.owner.name },
            property: {
                title: tx.property ? tx.property.title : 'Imóvel',
                address: tx.property ? tx.property.address : '',
                neighborhood: tx.property ? tx.property.neighborhood : ''
            },
            month: monthLabel,
            rentAmount: tx.rentAmount,
            platformFee: tx.feeAmount,
            feePercent: tx.feePercent,
            totalPaid: tx.totalAmount,
            ownerReceives: tx.ownerReceives,
            paymentMethod: 'PIX',
            mpPaymentId: tx.mpPaymentId || 'N/A',
            confirmedAt: tx.paidAt
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar recibo' });
    }
});

// ===== PUT /api/payments/rental/:rentalId/splits — Configurar % de cada inquilino =====
router.put('/rental/:rentalId/splits', validateId('rentalId'), authMiddleware, [
    body('splits').isArray({ min: 1 }).withMessage('Splits deve ser um array'),
    body('splits.*.tenant').isMongoId().withMessage('ID de inquilino inválido'),
    body('splits.*.percentage').isFloat({ min: 1, max: 100 }).withMessage('Porcentagem deve ser entre 1 e 100')
], async (req, res) => {
    try {
        var errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        var rental = await Rental.findById(req.params.rentalId)
            .populate('tenants', 'name');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });
        if (rental.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o proprietário pode configurar splits' });
        }

        var splits = req.body.splits;

        // Validar que todos os tenants do split existem no rental
        var rentalTenantIds = rental.tenants.map(function(t) { return t._id.toString(); });
        for (var s of splits) {
            if (!rentalTenantIds.includes(s.tenant)) {
                return res.status(400).json({ error: 'Inquilino ' + s.tenant + ' não faz parte deste aluguel' });
            }
        }

        // Validar que soma = 100
        var total = splits.reduce(function(sum, s) { return sum + Number(s.percentage); }, 0);
        if (Math.abs(total - 100) > 0.01) {
            return res.status(400).json({ error: 'A soma das porcentagens deve ser 100%. Atual: ' + total.toFixed(2) + '%' });
        }

        // Verificar que não há cobranças pendentes
        var currentMonth = new Date().toISOString().substring(0, 7);
        var pendingTx = await PaymentTransaction.findOne({
            rental: rental._id, month: currentMonth, status: 'pending'
        });
        if (pendingTx) {
            return res.status(400).json({ error: 'Não é possível alterar splits com cobranças pendentes no mês atual. Aguarde o pagamento ou cancele.' });
        }

        rental.tenantSplits = splits.map(function(s) {
            return { tenant: s.tenant, percentage: Number(s.percentage) };
        });
        await rental.save();

        // Retornar splits atualizados com nomes
        var result = rental.tenantSplits.map(function(s) {
            var tenantObj = rental.tenants.find(function(t) { return t._id.toString() === s.tenant.toString(); });
            return {
                tenant: s.tenant,
                name: tenantObj ? tenantObj.name : 'Desconhecido',
                percentage: s.percentage,
                valorEstimado: Math.round(rental.rentAmount * s.percentage / 100)
            };
        });

        res.json({
            message: 'Splits atualizados com sucesso',
            splits: result,
            aluguelTotal: rental.rentAmount
        });
    } catch (e) {
        if (e.message && e.message.includes('soma das porcentagens')) {
            return res.status(400).json({ error: e.message });
        }
        res.status(500).json({ error: 'Erro ao configurar splits' });
    }
});

// ===== GET /api/payments/rental/:rentalId/splits — Ver splits atuais =====
router.get('/rental/:rentalId/splits', validateId('rentalId'), authMiddleware, async (req, res) => {
    try {
        var rental = await Rental.findById(req.params.rentalId)
            .populate('tenants', 'name');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        var userId = req.user.userId;
        var isOwner = rental.owner.toString() === userId;
        var isTenant = rental.tenants.some(function(t) { return t._id.toString() === userId; });
        if (!isOwner && !isTenant) return res.status(403).json({ error: 'Sem permissão' });

        var hasSplits = rental.tenantSplits && rental.tenantSplits.length > 0;
        var splits = rental.tenants.map(function(t) {
            var split = hasSplits
                ? rental.tenantSplits.find(function(s) { return s.tenant.toString() === t._id.toString(); })
                : null;
            var percentage = split ? split.percentage : (100 / rental.tenants.length);
            return {
                tenant: t._id,
                name: t.name,
                percentage: Math.round(percentage * 100) / 100,
                valorEstimado: Math.round(rental.rentAmount * percentage / 100)
            };
        });

        res.json({
            splitType: hasSplits ? 'customizado' : 'igual',
            aluguelTotal: rental.rentAmount,
            splits: splits
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar splits' });
    }
});

module.exports = router;
