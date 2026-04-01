const express = require('express');
const router = express.Router();
const Rental = require('../models/Rental');
const authMiddleware = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

router.use(authMiddleware);

// GET /api/tenant/rentals — aluguéis do inquilino
router.get('/rentals', async (req, res) => {
    try {
        var rentals = await Rental.find({ tenants: req.user.userId, status: 'active' })
            .populate('property', 'title address neighborhood price images')
            .populate('owner', 'name')
            .sort({ createdAt: -1 });
        res.json({ rentals });
    } catch (e) {
        res.json({ rentals: [] });
    }
});

// GET /api/tenant/payments — pagamentos pendentes do inquilino
router.get('/payments', async (req, res) => {
    try {
        var rentals = await Rental.find({ tenants: req.user.userId })
            .populate('property', 'title neighborhood');

        var payments = [];
        for (var rental of rentals) {
            for (var p of rental.payments) {
                if (p.tenant.toString() === req.user.userId) {
                    payments.push({
                        rentalId: rental._id,
                        paymentId: p._id,
                        property: rental.property,
                        amount: p.amount,
                        feeIncluded: p.feeIncluded,
                        month: p.month,
                        status: p.status,
                        paidAt: p.paidAt
                    });
                }
            }
        }

        payments.sort(function(a, b) { return a.month > b.month ? -1 : 1; });
        res.json({ payments });
    } catch (e) {
        res.json({ payments: [] });
    }
});

// POST /api/tenant/payments/:rentalId/:paymentId/pay — DESABILITADO (usar Mercado Pago)
// Endpoint antigo de pagamento simulado removido por segurança.
// Pagamentos devem ser feitos exclusivamente via Mercado Pago PIX.
router.post('/payments/:rentalId/:paymentId/pay', validateId('rentalId'), validateId('paymentId'), async (req, res) => {
    return res.status(403).json({
        error: 'Pagamento simulado desabilitado. Use o sistema de pagamento via PIX (Mercado Pago).'
    });
});

module.exports = router;
