const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AgentCommission = require('../models/AgentCommission');
const authMiddleware = require('../middleware/auth');
const { TIERS, getTierByName, getNextTier, recalcAgentTier, generateReferralCode } = require('../services/commissionService');

// All routes require auth + agency role
router.use(authMiddleware);
router.use(function(req, res, next) {
    if (req.user.role !== 'agency') {
        return res.status(403).json({ error: 'Apenas corretores/imobiliarias podem acessar' });
    }
    next();
});

// GET /api/agent-rewards/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        var profile = user.agentProfile || {};
        var tier = getTierByName(profile.tier || 'iniciante');
        var next = getNextTier(tier.name);

        // Recent commissions
        var recentCommissions = await AgentCommission.find({ agent: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('property', 'title');

        // Monthly earnings (last 6 months)
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        var monthlyAgg = await AgentCommission.aggregate([
            { $match: { agent: user._id, type: 'rental_commission', status: { $in: ['available', 'paid_out'] }, createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: '$month', total: { $sum: '$amount' } } },
            { $sort: { _id: -1 } }
        ]);
        var monthlyEarnings = {};
        monthlyAgg.forEach(function(m) { if (m._id) monthlyEarnings[m._id] = m.total; });

        res.json({
            tier: tier.name,
            tierLabel: tier.label,
            commissionRate: tier.rate,
            availableBalance: profile.availableBalance || 0,
            totalEarned: profile.totalEarned || 0,
            totalPaidOut: profile.totalPaidOut || 0,
            activeListings: profile.activeListings || 0,
            totalRentals: profile.totalRentals || 0,
            nextTier: next ? {
                name: next.label,
                rate: next.rate,
                listingsNeeded: Math.max(0, next.listings - (profile.activeListings || 0)),
                rentalsNeeded: Math.max(0, next.rentals - (profile.totalRentals || 0))
            } : null,
            recentCommissions: recentCommissions,
            referralCode: profile.referralCode || '',
            monthlyEarnings: monthlyEarnings
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
});

// GET /api/agent-rewards/commissions
router.get('/commissions', async (req, res) => {
    try {
        var page = Math.max(1, parseInt(req.query.page) || 1);
        var limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        var query = { agent: req.user.userId };
        if (req.query.month) query.month = req.query.month;
        if (req.query.type) query.type = req.query.type;

        var total = await AgentCommission.countDocuments(query);
        var commissions = await AgentCommission.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('property', 'title');

        res.json({ commissions, total, page, pages: Math.ceil(total / limit) });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar comissoes' });
    }
});

// GET /api/agent-rewards/tier
router.get('/tier', async (req, res) => {
    try {
        var tier = await recalcAgentTier(req.user.userId);
        var user = await User.findById(req.user.userId);
        var profile = user.agentProfile || {};
        var next = getNextTier(tier.name);

        res.json({
            current: {
                name: tier.name,
                label: tier.label,
                rate: tier.rate,
                listings: profile.activeListings || 0,
                rentals: profile.totalRentals || 0
            },
            next: next ? {
                name: next.name,
                label: next.label,
                rate: next.rate,
                listingsRequired: next.listings,
                rentalsRequired: next.rentals,
                listingsNeeded: Math.max(0, next.listings - (profile.activeListings || 0)),
                rentalsNeeded: Math.max(0, next.rentals - (profile.totalRentals || 0))
            } : null,
            allTiers: TIERS.map(function(t) { return { name: t.name, label: t.label, rate: t.rate, listings: t.listings, rentals: t.rentals }; }).reverse()
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar tier' });
    }
});

// POST /api/agent-rewards/payout
router.post('/payout', async (req, res) => {
    try {
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        var balance = user.agentProfile ? user.agentProfile.availableBalance : 0;
        if (balance <= 0) return res.status(400).json({ error: 'Saldo insuficiente' });

        var pixKey = (req.body.pixKey || '').trim();
        if (!pixKey) return res.status(400).json({ error: 'Chave PIX obrigatoria' });
        if (pixKey.length > 100) return res.status(400).json({ error: 'Chave PIX invalida' });

        // Save PIX key
        user.agentProfile.pixKey = pixKey;
        await user.save();

        // Create payout request (negative amount)
        await AgentCommission.create({
            agent: user._id,
            type: 'payout',
            amount: -balance,
            description: 'Saque solicitado - PIX: ' + pixKey,
            status: 'pending'
        });

        // Update balances
        await User.findByIdAndUpdate(user._id, {
            'agentProfile.availableBalance': 0,
            $inc: { 'agentProfile.totalPaidOut': balance }
        });

        res.json({
            message: 'Saque de R$' + balance.toFixed(2) + ' solicitado! Sera processado em ate 3 dias uteis.',
            amount: balance,
            pixKey: pixKey
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao solicitar saque' });
    }
});

// GET /api/agent-rewards/referral-code
router.get('/referral-code', async (req, res) => {
    try {
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        if (!user.agentProfile || !user.agentProfile.referralCode) {
            var code = generateReferralCode();
            // Ensure unique
            var attempts = 0;
            while (await User.findOne({ 'agentProfile.referralCode': code }) && attempts < 10) {
                code = generateReferralCode();
                attempts++;
            }
            await User.findByIdAndUpdate(user._id, { 'agentProfile.referralCode': code });
            return res.json({ referralCode: code });
        }

        res.json({ referralCode: user.agentProfile.referralCode });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar codigo' });
    }
});

// GET /api/agent-rewards/referrals
router.get('/referrals', async (req, res) => {
    try {
        var referrals = await User.find({ 'agentProfile.referredBy': req.user.userId })
            .select('name email createdAt agentProfile.tier agentProfile.activeListings')
            .sort({ createdAt: -1 });

        res.json({ referrals });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar indicacoes' });
    }
});

module.exports = router;
