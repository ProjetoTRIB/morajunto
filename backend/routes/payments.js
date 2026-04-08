const express = require('express');
const router = express.Router();
const https = require('https');
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
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const FEE_PERCENT = 8;

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
        var rentPerTenant = Math.round(rental.rentAmount / rental.tenants.length);
        var feePerTenant = Math.round(rentPerTenant * FEE_PERCENT / 100);
        var totalPerTenant = rentPerTenant + feePerTenant;

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
            var agentCommissionAmount = Math.round(feePerTenant * agentCommissionRate);
            return {
                rental: rental._id,
                property: rental.property._id,
                tenant: tenant._id,
                owner: rental.owner,
                tenantName: tenant.name,
                ownerName: owner ? owner.name : 'Proprietário',
                month: month,
                rentAmount: rentPerTenant,
                feePercent: FEE_PERCENT,
                feeAmount: feePerTenant,
                totalAmount: totalPerTenant,
                ownerReceives: rentPerTenant,
                dueDate: dueDate,
                agentId: agentId,
                agentCommission: agentCommissionAmount,
                platformNet: feePerTenant - agentCommissionAmount,
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

        res.json({
            message: 'Cobranças geradas para ' + month,
            transactions: transactions,
            summary: {
                aluguelTotal: rental.rentAmount,
                inquilinos: rental.tenants.length,
                porInquilino: rentPerTenant,
                taxaPorInquilino: feePerTenant,
                totalPorInquilino: totalPerTenant,
                moraJuntoRecebe: feePerTenant * rental.tenants.length,
                proprietarioRecebe: rental.rentAmount
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

        var tenant = await User.findById(req.user.userId);
        var description = 'MoraJunto - Aluguel ' + tx.month + ' - ' + (tx.property ? tx.property.title : 'Imóvel');

        try {
            // Try Mercado Pago PIX
            var mpResult = await createMPPixPayment(
                tx.totalAmount,
                description,
                tenant.email,
                tenant.name,
                tx._id.toString()
            );

            var pix = mpResult.point_of_interaction && mpResult.point_of_interaction.transaction_data;
            tx.mpPaymentId = String(mpResult.id);
            tx.mpStatus = mpResult.status;
            tx.pixQrCode = pix ? pix.qr_code : '';
            tx.pixQrCodeBase64 = pix ? pix.qr_code_base64 : '';
            await tx.save();

            res.json({
                transactionId: tx._id,
                mpPaymentId: mpResult.id,
                qrCode: tx.pixQrCode,
                qrCodeBase64: tx.pixQrCodeBase64,
                amount: tx.totalAmount,
                description: description
            });
        } catch (mpError) {
            // Mercado Pago failed — return simulation mode
            tx.mpStatus = 'simulation';
            await tx.save();

            res.json({
                transactionId: tx._id,
                simulation: true,
                amount: tx.totalAmount,
                description: description,
                message: 'PIX em modo simulação. Em produção, o QR Code será gerado automaticamente.',
                pixCode: 'MORAJUNTO' + tx._id.toString().substring(0, 8).toUpperCase()
            });
        }
    } catch (e) {
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

        // If has MP payment ID, check status
        if (tx.mpPaymentId && tx.mpStatus !== 'simulation' && MP_TOKEN) {
            try {
                var mpResult = await checkMPPayment(tx.mpPaymentId);
                if (mpResult.status === 'approved' && tx.status !== 'paid') {
                    tx.status = 'paid';
                    tx.mpStatus = 'approved';
                    tx.paidAt = new Date();
                    await tx.save();
                    await creditAgentCommission(tx);
                }
            } catch (e) { /* MP check failed, return current status */ }
        }

        res.json({
            status: tx.status,
            mpStatus: tx.mpStatus,
            amount: tx.totalAmount,
            paidAt: tx.paidAt
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

// ===== POST /api/payments/webhook — Mercado Pago webhook =====
const crypto = require('crypto');

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

module.exports = router;
