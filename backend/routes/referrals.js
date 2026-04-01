const express = require('express');
const router = express.Router();
const multer = require('multer');
const PropertyReferral = require('../models/PropertyReferral');
const authMiddleware = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');
const { createStorage } = require('../config/cloudinary');

var referralUpload = multer({
    storage: createStorage('morajunto/referrals'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/referrals — any logged-in user can submit (with image upload)
router.post('/', authMiddleware, referralUpload.array('photos', 5), async (req, res) => {
    try {
        var ownerName = (req.body.ownerName || '').trim();
        var ownerPhone = (req.body.ownerPhone || '').trim();
        var ownerEmail = (req.body.ownerEmail || '').trim();
        var address = (req.body.address || '').trim();
        var neighborhood = (req.body.neighborhood || '').trim();
        var description = (req.body.description || '').trim();

        // Collect photos from uploaded files
        var photos = [];
        if (req.files && req.files.length > 0) {
            photos = req.files.map(function(f) { return f.path; });
        }

        if (!ownerName || ownerName.length < 2) return res.status(400).json({ error: 'Nome do proprietario obrigatorio (min 2 caracteres)' });
        if (!ownerPhone || ownerPhone.length < 8) return res.status(400).json({ error: 'Telefone do proprietario obrigatorio (min 8 digitos)' });
        if (!address || address.length < 5) return res.status(400).json({ error: 'Endereco obrigatorio (min 5 caracteres)' });
        if (!neighborhood || neighborhood.length < 2) return res.status(400).json({ error: 'Bairro obrigatorio' });

        // Check duplicate (same address by same user, still active)
        var existing = await PropertyReferral.findOne({
            referrer: req.user.userId,
            address: { $regex: new RegExp('^' + address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
            status: { $nin: ['rejected', 'paid'] }
        });
        if (existing) return res.status(400).json({ error: 'Voce ja indicou este endereco' });

        var referral = await PropertyReferral.create({
            referrer: req.user.userId,
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            ownerEmail: ownerEmail,
            address: address,
            neighborhood: neighborhood,
            description: description,
            photos: photos
        });

        res.status(201).json({ message: 'Indicacao enviada com sucesso! Vamos validar e entrar em contato com o proprietario.', referral: referral });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar indicacao' });
    }
});

// GET /api/referrals/my — my referrals
router.get('/my', authMiddleware, async (req, res) => {
    try {
        var referrals = await PropertyReferral.find({ referrer: req.user.userId })
            .sort({ createdAt: -1 })
            .populate('property', 'title price');
        res.json({ referrals: referrals });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar indicacoes' });
    }
});

// GET /api/referrals/pix — retorna chave PIX do indicador
router.get('/pix', authMiddleware, async (req, res) => {
    try {
        var User = require('../models/User');
        var user = await User.findById(req.user.userId).select('pixKey pixKeyType');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ pixKey: user.pixKey || '', pixKeyType: user.pixKeyType || '' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar chave PIX' });
    }
});

// POST /api/referrals/pix — salva chave PIX do indicador
router.post('/pix', authMiddleware, async (req, res) => {
    try {
        var User = require('../models/User');
        var { pixKey, pixKeyType } = req.body;
        if (!pixKey || !pixKeyType) {
            return res.status(400).json({ error: 'Chave PIX e tipo são obrigatórios' });
        }
        pixKey = pixKey.trim().substring(0, 100);
        var validTypes = ['cpf', 'email', 'telefone', 'aleatoria'];
        if (!validTypes.includes(pixKeyType)) {
            return res.status(400).json({ error: 'Tipo de chave inválido' });
        }

        var user = await User.findByIdAndUpdate(req.user.userId, { pixKey, pixKeyType }, { new: true });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Chave PIX salva com sucesso', pixKey: user.pixKey, pixKeyType: user.pixKeyType });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar chave PIX' });
    }
});

// GET /api/referrals — admin: list all
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

        var page = Math.max(1, parseInt(req.query.page) || 1);
        var limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        var query = {};
        if (req.query.status) query.status = req.query.status;

        var total = await PropertyReferral.countDocuments(query);
        var referrals = await PropertyReferral.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('referrer', 'name email phone')
            .populate('property', 'title');

        res.json({ referrals: referrals, total: total, page: page, pages: Math.ceil(total / limit) });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar indicacoes' });
    }
});

// PUT /api/referrals/:id/status — admin: update status
router.put('/:id/status', authMiddleware, validateId('id'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

        var referral = await PropertyReferral.findById(req.params.id);
        if (!referral) return res.status(404).json({ error: 'Indicacao nao encontrada' });

        var newStatus = req.body.status;
        var validTransitions = {
            pending: ['validated', 'rejected'],
            validated: ['listed', 'rejected'],
            listed: ['rented', 'rejected'],
            rented: ['paid']
        };

        var allowed = validTransitions[referral.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({ error: 'Transicao invalida: ' + referral.status + ' -> ' + newStatus });
        }

        referral.status = newStatus;
        if (req.body.adminNotes) referral.adminNotes = req.body.adminNotes;

        if (newStatus === 'rejected') {
            referral.rejectionReason = req.body.rejectionReason || 'Nao atende aos criterios';
        }

        if (newStatus === 'listed' && req.body.propertyId) {
            referral.property = req.body.propertyId;
        }

        if (newStatus === 'paid') {
            referral.rewardAmount = parseFloat(req.body.rewardAmount) || 100;
            referral.paidAt = new Date();
        }

        await referral.save();
        res.json({ message: 'Status atualizado para: ' + newStatus, referral: referral });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar indicacao' });
    }
});

module.exports = router;
