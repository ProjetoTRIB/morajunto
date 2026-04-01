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

        var safePage = Math.max(1, Math.min(Number(page) || 1, 1000));
        var safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
        const skip = (safePage - 1) * safeLimit;
        const total = await Republica.countDocuments(query);
        const republicas = await Republica.find(query)
            .populate('owner', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit);

        res.json({
            republicas,
            total,
            page: safePage,
            totalPages: Math.ceil(total / safeLimit)
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar repúblicas' });
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
        res.status(500).json({ error: 'Erro ao buscar república' });
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

        if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Nome da república é obrigatório' });
        if (name.length > 100) return res.status(400).json({ error: 'Nome muito longo (máx 100 caracteres)' });

        // Validate numeric fields
        var safePrice = Math.max(0, Math.min(Number(price) || 0, 100000));
        var safeSplitPrice = Math.max(0, Math.min(Number(splitPrice) || 0, 100000));
        var safeMaxMembers = Math.max(1, Math.min(Number(maxMembers) || 4, 50));
        var safeAvailableSpots = Math.max(0, Math.min(Number(availableSpots) || 1, 50));
        var safeLat = latitude ? Math.max(-90, Math.min(Number(latitude), 90)) : undefined;
        var safeLng = longitude ? Math.max(-180, Math.min(Number(longitude), 180)) : undefined;

        // Validate arrays
        var safePhotos = Array.isArray(photos) ? photos.filter(function(p) { return typeof p === 'string'; }).slice(0, 20).map(function(p) { return p.substring(0, 500); }) : [];
        var safeFeatures = Array.isArray(features) ? features.filter(function(f) { return typeof f === 'string'; }).slice(0, 20).map(function(f) { return f.substring(0, 100); }) : [];
        var safeRules = Array.isArray(rules) ? rules.filter(function(r) { return typeof r === 'string'; }).slice(0, 20).map(function(r) { return r.substring(0, 200); }) : [];

        // Validate genderPolicy enum
        var validGenderPolicies = ['feminina', 'masculina', 'mista'];
        var safeGenderPolicy = validGenderPolicies.includes(genderPolicy) ? genderPolicy : 'mista';

        const republica = await Republica.create({
            name: name.substring(0, 100),
            description: (description || '').substring(0, 2000),
            owner: req.user.userId,
            members: [req.user.userId],
            maxMembers: safeMaxMembers,
            price: safePrice,
            splitPrice: safeSplitPrice,
            address: (address || '').substring(0, 300),
            neighborhood: (neighborhood || '').substring(0, 100),
            city: (city || 'Ribeirão Preto').substring(0, 100),
            latitude: safeLat,
            longitude: safeLng,
            photos: safePhotos,
            features: safeFeatures,
            rules: safeRules,
            genderPolicy: safeGenderPolicy,
            university: (university || '').substring(0, 100),
            availableSpots: safeAvailableSpots,
            status: 'active'
        });

        res.status(201).json({ republica });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar república' });
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
        res.status(500).json({ error: 'Erro ao atualizar república' });
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
        res.status(500).json({ error: 'Erro ao deletar república' });
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
        res.status(500).json({ error: 'Erro ao se candidatar' });
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
        res.status(500).json({ error: 'Erro ao buscar candidatos' });
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

        // Atomic update to prevent race condition on availableSpots
        const updated = await Republica.findOneAndUpdate(
            {
                _id: req.params.id,
                availableSpots: { $gt: 0 },
                'applicants.user': req.params.userId
            },
            {
                $inc: { availableSpots: -1 },
                $pull: { applicants: { user: req.params.userId } },
                $addToSet: { members: req.params.userId }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(400).json({ error: 'Não foi possível aprovar — sem vagas ou candidato não encontrado' });
        }

        // Set status to full if no spots left
        if (updated.availableSpots <= 0) {
            updated.status = 'full';
        }

        // Recalculate split price
        if (updated.price > 0 && updated.members.length > 0) {
            updated.splitPrice = Math.round(updated.price / updated.members.length);
        }

        await updated.save();
        res.json({ message: 'Candidato aprovado!', republica: updated });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao aprovar candidato' });
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
        res.status(500).json({ error: 'Erro ao rejeitar candidato' });
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
        res.status(500).json({ error: 'Erro ao sair da república' });
    }
});

module.exports = router;
