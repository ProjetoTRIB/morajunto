const express = require('express');
const router = express.Router();
const Republica = require('../models/Republica');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

// GET / — list all active repúblicas with filters, paginated
router.get('/', async (req, res) => {
    try {
        const {
            neighborhood,
            genderPolicy,
            university,
            maxPrice,
            spotsAvailable,
            page = 1,
            limit = 20
        } = req.query;

        const query = { status: 'active' };

        function escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        if (neighborhood) query.neighborhood = new RegExp(escapeRegex(neighborhood), 'i');
        if (genderPolicy) query.genderPolicy = genderPolicy;
        if (university) query.university = new RegExp(escapeRegex(university), 'i');
        if (maxPrice) query.splitPrice = { $lte: Number(maxPrice) };
        if (spotsAvailable) query.availableSpots = { $gte: Number(spotsAvailable) };

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Republica.countDocuments(query);
        const republicas = await Republica.find(query)
            .populate('owner', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.json({
            republicas,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar repúblicas: ' });
    }
});

// GET /:id — get república detail
router.get('/:id', validateId('id'), async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id)
            .populate('owner', 'name roommateProfile profilePhoto')
            .populate('members', 'name roommateProfile profilePhoto');
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });
        res.json({ republica });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar república: ' });
    }
});

// POST / — create república (auth required)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            name, description, maxMembers, price, splitPrice,
            address, neighborhood, city, latitude, longitude,
            photos, features, rules, genderPolicy, university, availableSpots
        } = req.body;

        if (!name) return res.status(400).json({ error: 'Nome da república é obrigatório' });

        const republica = await Republica.create({
            name,
            description: description || '',
            owner: req.user.userId,
            members: [req.user.userId],
            maxMembers: maxMembers || 4,
            price: price || 0,
            splitPrice: splitPrice || 0,
            address: address || '',
            neighborhood: neighborhood || '',
            city: city || 'Ribeirão Preto',
            latitude,
            longitude,
            photos: photos || [],
            features: features || [],
            rules: rules || [],
            genderPolicy: genderPolicy || 'mista',
            university: university || '',
            availableSpots: availableSpots || 1,
            status: 'active'
        });

        res.status(201).json({ republica });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar república: ' });
    }
});

// PUT /:id — update (owner only)
router.put('/:id', validateId('id'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });
        if (republica.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o dono pode editar a república' });
        }

        const allowedFields = [
            'name', 'description', 'maxMembers', 'price', 'splitPrice',
            'address', 'neighborhood', 'city', 'latitude', 'longitude',
            'photos', 'features', 'rules', 'genderPolicy', 'university',
            'availableSpots', 'status'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) republica[field] = req.body[field];
        });

        await republica.save();
        res.json({ republica });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar república: ' });
    }
});

// DELETE /:id — delete (owner or admin)
router.delete('/:id', validateId('id'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        const user = await User.findById(req.user.userId);
        const isOwner = republica.owner.toString() === req.user.userId;
        const isAdmin = user && user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Sem permissão para deletar' });
        }

        await Republica.findByIdAndDelete(req.params.id);
        res.json({ message: 'República removida com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao deletar república: ' });
    }
});

// POST /:id/apply — apply to join (auth required)
router.post('/:id/apply', validateId('id'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        if (republica.status !== 'active') {
            return res.status(400).json({ error: 'República não está aceitando candidatos' });
        }

        if (republica.availableSpots <= 0) {
            return res.status(400).json({ error: 'Não há vagas disponíveis' });
        }

        // Check if already a member
        if (republica.members.some(m => m.toString() === req.user.userId)) {
            return res.status(400).json({ error: 'Você já é membro desta república' });
        }

        // Check if already applied
        if (republica.applicants.some(a => a.user.toString() === req.user.userId)) {
            return res.status(400).json({ error: 'Você já se candidatou a esta república' });
        }

        var applyMessage = (req.body.message || '').substring(0, 500);
        republica.applicants.push({
            user: req.user.userId,
            message: applyMessage,
            createdAt: new Date()
        });

        await republica.save();
        res.json({ message: 'Candidatura enviada com sucesso!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao se candidatar: ' });
    }
});

// GET /:id/applicants — list pending applicants (owner only)
router.get('/:id/applicants', validateId('id'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id)
            .populate('applicants.user', 'name roommateProfile socialVerified profilePhoto');
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        if (republica.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o dono pode ver candidatos' });
        }

        res.json({ applicants: republica.applicants });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar candidatos: ' });
    }
});

// POST /:id/approve/:userId — approve applicant (owner only)
router.post('/:id/approve/:userId', validateId('id'), validateId('userId'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        if (republica.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o dono pode aprovar candidatos' });
        }

        const applicantIndex = republica.applicants.findIndex(
            a => a.user.toString() === req.params.userId
        );
        if (applicantIndex === -1) {
            return res.status(404).json({ error: 'Candidato não encontrado' });
        }

        if (republica.availableSpots <= 0 || republica.members.length >= republica.maxMembers) {
            return res.status(400).json({ error: 'Não há vagas disponíveis' });
        }

        // Remove from applicants
        republica.applicants.splice(applicantIndex, 1);

        // Add to members
        if (!republica.members.some(m => m.toString() === req.params.userId)) {
            republica.members.push(req.params.userId);
        }

        // Update available spots
        republica.availableSpots -= 1;
        if (republica.availableSpots <= 0) {
            republica.status = 'full';
        }

        // Recalculate split price
        if (republica.price > 0 && republica.members.length > 0) {
            republica.splitPrice = Math.round(republica.price / republica.members.length);
        }

        await republica.save();
        res.json({ message: 'Candidato aprovado!', republica });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao aprovar candidato: ' });
    }
});

// POST /:id/reject/:userId — reject applicant (owner only)
router.post('/:id/reject/:userId', validateId('id'), validateId('userId'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        if (republica.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Apenas o dono pode rejeitar candidatos' });
        }

        const applicantIndex = republica.applicants.findIndex(
            a => a.user.toString() === req.params.userId
        );
        if (applicantIndex === -1) {
            return res.status(404).json({ error: 'Candidato não encontrado' });
        }

        republica.applicants.splice(applicantIndex, 1);
        await republica.save();

        res.json({ message: 'Candidato rejeitado' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao rejeitar candidato: ' });
    }
});

// POST /:id/leave — leave república (member, not owner)
router.post('/:id/leave', validateId('id'), authMiddleware, async (req, res) => {
    try {
        const republica = await Republica.findById(req.params.id);
        if (!republica) return res.status(404).json({ error: 'República não encontrada' });

        if (republica.owner.toString() === req.user.userId) {
            return res.status(400).json({ error: 'O dono não pode sair da república. Transfira a posse ou delete.' });
        }

        const memberIndex = republica.members.findIndex(
            m => m.toString() === req.user.userId
        );
        if (memberIndex === -1) {
            return res.status(400).json({ error: 'Você não é membro desta república' });
        }

        republica.members.splice(memberIndex, 1);
        republica.availableSpots += 1;

        if (republica.status === 'full') {
            republica.status = 'active';
        }

        // Recalculate split price
        if (republica.price > 0 && republica.members.length > 0) {
            republica.splitPrice = Math.round(republica.price / republica.members.length);
        }

        await republica.save();
        res.json({ message: 'Você saiu da república' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao sair da república: ' });
    }
});

module.exports = router;
