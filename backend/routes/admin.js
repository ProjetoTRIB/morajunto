const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const OwnerLead = require('../models/OwnerLead');
const authMiddleware = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/auth');
const connectDB = require('../config/db');
const { validateId } = require('../middleware/validateId');

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
        var totalUsers = await User.countDocuments({ role: 'user' });
        var totalAgencies = await User.countDocuments({ role: 'agency' });
        var totalLeads = await Lead.countDocuments();

        res.json({ totalProperties, activeProperties, totalUsers, totalAgencies, totalLeads,
            properties: totalProperties, agencies: totalAgencies, leads: totalLeads, users: totalUsers });
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
        var result = [];
        for (var a of agencies) {
            var count = await Property.countDocuments({ agency: a._id });
            result.push({ _id: a._id, name: a.name, email: a.email, phone: a.phone || '', propertyCount: count, createdAt: a.createdAt });
        }
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
            'condominio', 'condo', 'iptu', 'bedrooms', 'bathrooms', 'parking',
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

module.exports = router;
