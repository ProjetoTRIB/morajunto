const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const OwnerLead = require('../models/OwnerLead');
const Rental = require('../models/Rental');
const PaymentTransaction = require('../models/PaymentTransaction');
const AgentCommission = require('../models/AgentCommission');
const Report = require('../models/Report');
const Republica = require('../models/Republica');
const Conversation = require('../models/Conversation');
const authMiddleware = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/auth');
const connectDB = require('../config/db');
const { validateId } = require('../middleware/validateId');
const emailService = require('../services/emailService');

function requireDB(req, res, next) {
    if (!connectDB.isConnected()) return res.status(503).json({ error: 'Banco de dados não disponível.' });
    next();
}

router.use(requireDB);
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/stats — estatísticas gerais
router.get('/stats', async (req, res) => {
    try {
        var totalProperties = await Property.countDocuments();
        var activeProperties = await Property.countDocuments({ status: 'active' });
        var totalUsers = await User.countDocuments();
        var totalAgencies = await User.countDocuments({ role: 'agency' });
        var totalLeads = await Lead.countDocuments();
        var pendingVerifications = await User.countDocuments({ 'identityVerification.status': 'pending' });
        var ownerLeads = await OwnerLead.countDocuments();
        var totalRentals = await Rental.countDocuments({ status: 'active' });
        var pendingReports = await Report.countDocuments({ status: 'pending' });
        var revenueAgg = await PaymentTransaction.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$feeAmount' } } }
        ]);
        var platformRevenue = revenueAgg[0] ? revenueAgg[0].total : 0;

        res.json({ totalProperties, activeProperties, totalUsers, totalAgencies, totalLeads, pendingVerifications, ownerLeads, totalRentals, pendingReports, platformRevenue });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// GET /api/admin/leads — todos os leads
router.get('/leads', async (req, res) => {
    try {
        var leads = await Lead.find()
            .populate('property', 'title type transaction price')
            .populate('agency', 'name email')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json(leads);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar leads' });
    }
});

// GET /api/admin/agencies — todas as imobiliárias
router.get('/agencies', async (req, res) => {
    try {
        var agencies = await User.find({ role: 'agency' }).select('-password').sort({ createdAt: -1 });
        var agencyIds = agencies.map(function(a) { return a._id; });
        var counts = await Property.aggregate([
            { $match: { agency: { $in: agencyIds } } },
            { $group: { _id: '$agency', count: { $sum: 1 } } }
        ]);
        var countMap = {};
        counts.forEach(function(c) { countMap[c._id.toString()] = c.count; });
        var result = agencies.map(function(a) {
            return { _id: a._id, name: a.name, email: a.email, phone: a.phone || '', propertyCount: countMap[a._id.toString()] || 0, createdAt: a.createdAt };
        });
        res.json({ agencies: result });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar imobiliárias' });
    }
});

// GET /api/admin/properties — todos os imóveis com agency populada
router.get('/properties', async (req, res) => {
    try {
        var properties = await Property.find()
            .populate('agency', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json(properties);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar imóveis' });
    }
});

// PUT /api/admin/properties/:id — atualizar qualquer imóvel (whitelist fields)
router.put('/properties/:id', validateId('id'), async (req, res) => {
    try {
        var allowedFields = ['title', 'description', 'type', 'transaction', 'price',
            'condominio', 'iptu', 'bedrooms', 'bathrooms', 'parking',
            'area', 'address', 'neighborhood', 'city', 'photos', 'images',
            'features', 'status'];
        var updates = {};
        allowedFields.forEach(function(f) {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });

        var property = await Property.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('agency', 'name email phone');
        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }
        res.json(property);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar imóvel' });
    }
});

// DELETE /api/admin/properties/:id — remover qualquer imóvel
router.delete('/properties/:id', validateId('id'), async (req, res) => {
    try {
        var property = await Property.findByIdAndDelete(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }
        // Remover leads associados
        await Lead.deleteMany({ property: req.params.id });
        res.json({ message: 'Imóvel removido com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao remover imóvel' });
    }
});

// GET /api/admin/verifications — pending identity verifications
router.get('/verifications', async (req, res) => {
    try {
        var users = await User.find({ 'identityVerification.status': 'pending' })
            .select('name email profilePhoto identityVerification createdAt')
            .sort({ 'identityVerification.submittedAt': -1 })
            .limit(50);
        res.json({ verifications: users });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar verificacoes' });
    }
});

// PUT /api/admin/verifications/:userId — approve or reject
router.put('/verifications/:userId', validateId('userId'), async (req, res) => {
    try {
        var { action, reason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Acao invalida' });
        }

        var user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        if (action === 'approve') {
            user.identityVerification.status = 'approved';
            user.identityVerification.reviewedAt = new Date();
        } else {
            user.identityVerification.status = 'rejected';
            user.identityVerification.reviewedAt = new Date();
            user.identityVerification.rejectionReason = (reason || 'Documento invalido').substring(0, 200);
        }
        await user.save();

        // Enviar email notificando o usuário
        emailService.sendVerificationStatusEmail(
            user.email,
            user.name,
            action === 'approve' ? 'approved' : 'rejected',
            user.identityVerification.rejectionReason
        );

        res.json({ message: action === 'approve' ? 'Identidade aprovada' : 'Verificacao rejeitada' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao processar verificacao' });
    }
});

// GET /api/admin/owner-leads — leads de proprietários interessados
router.get('/owner-leads', async (req, res) => {
    try {
        var leads = await OwnerLead.find().sort({ createdAt: -1 }).limit(100);
        res.json({ leads });
    } catch (e) {
        res.json({ leads: [] });
    }
});

// PUT /api/admin/owner-leads/:id — atualizar status do lead
router.put('/owner-leads/:id', validateId('id'), async (req, res) => {
    try {
        var { status, notes } = req.body;
        if (!['pending', 'contacted', 'converted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        var lead = await OwnerLead.findByIdAndUpdate(req.params.id, {
            status: status,
            notes: (notes || '').substring(0, 500)
        }, { new: true });
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
        res.json({ lead });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
});

// ===== RENTALS & PAYMENTS =====

// GET /api/admin/rentals — todos os aluguéis
router.get('/rentals', async (req, res) => {
    try {
        var rentals = await Rental.find()
            .populate('property', 'title neighborhood')
            .populate('owner', 'name email')
            .populate('tenants', 'name email')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ rentals });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar aluguéis' });
    }
});

// GET /api/admin/payments — todas as transações
router.get('/payments', async (req, res) => {
    try {
        var payments = await PaymentTransaction.find()
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ payments });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar pagamentos' });
    }
});

// PUT /api/admin/payments/:id/confirm — confirmar pagamento manualmente
router.put('/payments/:id/confirm', validateId('id'), async (req, res) => {
    try {
        var tx = await PaymentTransaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });
        if (tx.status === 'paid') return res.status(400).json({ error: 'Já está pago' });
        tx.status = 'paid';
        tx.mpStatus = 'manual_confirm';
        tx.paidAt = new Date();
        tx.confirmedBy = 'admin';
        await tx.save();
        res.json({ message: 'Pagamento confirmado manualmente', tx });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao confirmar pagamento' });
    }
});

// ===== AGENT COMMISSIONS =====

// GET /api/admin/agents — agentes com tier e saldo
router.get('/agents', async (req, res) => {
    try {
        var agents = await User.find({ role: 'agency' })
            .select('name email phone agentProfile createdAt')
            .sort({ createdAt: -1 });
        res.json({ agents });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar agentes' });
    }
});

// GET /api/admin/commissions — todas as comissões
router.get('/commissions', async (req, res) => {
    try {
        var commissions = await AgentCommission.find()
            .populate('agent', 'name email')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ commissions });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar comissões' });
    }
});

// PUT /api/admin/agents/:id/payout — processar payout do agente
router.put('/agents/:id/payout', validateId('id'), async (req, res) => {
    try {
        var agent = await User.findById(req.params.id);
        if (!agent || agent.role !== 'agency') return res.status(404).json({ error: 'Agente não encontrado' });
        var balance = agent.agentProfile ? agent.agentProfile.availableBalance : 0;
        if (balance <= 0) return res.status(400).json({ error: 'Saldo zero' });

        await AgentCommission.create({
            agent: agent._id,
            type: 'payout',
            amount: -balance,
            description: 'Payout admin - R$' + balance.toFixed(2),
            status: 'paid_out',
            paidOutAt: new Date(),
            tierAtTime: agent.agentProfile ? agent.agentProfile.tier : 'iniciante'
        });

        agent.agentProfile.totalPaidOut = (agent.agentProfile.totalPaidOut || 0) + balance;
        agent.agentProfile.availableBalance = 0;
        await agent.save();

        res.json({ message: 'Payout de R$' + balance.toFixed(2) + ' processado' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao processar payout' });
    }
});

// ===== REPORTS/DENÚNCIAS =====

// GET /api/admin/reports — todas as denúncias
router.get('/reports', async (req, res) => {
    try {
        var reports = await Report.find()
            .populate('reporter', 'name email')
            .populate('reported', 'name email')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ reports });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar denúncias' });
    }
});

// PUT /api/admin/reports/:id — resolver/dispensar denúncia
router.put('/reports/:id', validateId('id'), async (req, res) => {
    try {
        var { status, adminNote } = req.body;
        if (!['reviewed', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        var report = await Report.findByIdAndUpdate(req.params.id, {
            status,
            adminNote: (adminNote || '').substring(0, 500),
            resolvedAt: new Date()
        }, { new: true });
        if (!report) return res.status(404).json({ error: 'Denúncia não encontrada' });
        res.json({ report });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar denúncia' });
    }
});

// ===== REPÚBLICAS =====

// GET /api/admin/republicas — todas as repúblicas
router.get('/republicas', async (req, res) => {
    try {
        var republicas = await Republica.find()
            .populate('owner', 'name email')
            .populate('members', 'name')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ republicas });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar repúblicas' });
    }
});

// DELETE /api/admin/republicas/:id
router.delete('/republicas/:id', validateId('id'), async (req, res) => {
    try {
        var rep = await Republica.findByIdAndDelete(req.params.id);
        if (!rep) return res.status(404).json({ error: 'República não encontrada' });
        res.json({ message: 'República removida' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao remover república' });
    }
});

// ===== CHAT/MODERAÇÃO =====

// GET /api/admin/conversations — conversas recentes
router.get('/conversations', async (req, res) => {
    try {
        var conversations = await Conversation.find()
            .populate('participants', 'name email')
            .sort({ lastMessageAt: -1 })
            .limit(100);
        res.json({ conversations });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar conversas' });
    }
});

// GET /api/admin/conversations/:id/messages — mensagens de uma conversa
router.get('/conversations/:id/messages', validateId('id'), async (req, res) => {
    try {
        var conv = await Conversation.findById(req.params.id)
            .populate('participants', 'name email');
        if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
        res.json({ conversation: conv });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// ===== USERS =====

// GET /api/admin/users — listar todos os usuários com filtro
router.get('/users', async (req, res) => {
    try {
        var query = {};
        if (req.query.role && ['user', 'agency', 'owner', 'admin'].includes(req.query.role)) {
            query.role = req.query.role;
        }
        if (req.query.search) {
            var s = req.query.search.substring(0, 100);
            query.$or = [
                { name: { $regex: s, $options: 'i' } },
                { email: { $regex: s, $options: 'i' } }
            ];
        }
        var users = await User.find(query)
            .select('-password -verificationCode')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ users });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// PUT /api/admin/users/:id/role — alterar role do usuário
router.put('/users/:id/role', validateId('id'), async (req, res) => {
    try {
        var { role } = req.body;
        if (!['user', 'agency', 'owner'].includes(role)) {
            return res.status(400).json({ error: 'Role inválida' });
        }
        var user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ user });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao alterar role' });
    }
});

// PUT /api/admin/users/:id/suspend — suspender/reativar conta
router.put('/users/:id/suspend', validateId('id'), async (req, res) => {
    try {
        var user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        if (user.role === 'admin') return res.status(403).json({ error: 'Não é possível suspender um admin' });

        var isSuspended = !!user.lockUntil && user.lockUntil > new Date('2099-01-01');
        if (isSuspended) {
            user.lockUntil = undefined;
            user.loginAttempts = 0;
        } else {
            user.lockUntil = new Date('2099-12-31');
        }
        await user.save();
        res.json({ message: isSuspended ? 'Conta reativada' : 'Conta suspensa', suspended: !isSuspended });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao suspender/reativar' });
    }
});

module.exports = router;
