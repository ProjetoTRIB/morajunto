const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

// POST /api/reports — criar denuncia
router.post('/', authMiddleware, async (req, res) => {
    try {
        var { reportedUserId, conversationId, reason, description } = req.body;

        if (!reportedUserId || !reason) {
            return res.status(400).json({ error: 'Usuario e motivo sao obrigatorios' });
        }

        if (reportedUserId === req.user.userId) {
            return res.status(400).json({ error: 'Voce nao pode denunciar a si mesmo' });
        }

        var validReasons = ['scam', 'harassment', 'fake_profile', 'contact_bypass', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Motivo invalido' });
        }

        // Prevent duplicate reports
        var existing = await Report.findOne({
            reporter: req.user.userId,
            reported: reportedUserId,
            status: 'pending'
        });
        if (existing) {
            return res.status(400).json({ error: 'Voce ja denunciou este usuario. Aguarde a analise.' });
        }

        var report = await Report.create({
            reporter: req.user.userId,
            reported: reportedUserId,
            conversation: conversationId || undefined,
            reason: reason,
            description: (description || '').substring(0, 500)
        });

        res.status(201).json({ message: 'Denuncia enviada. Vamos analisar o mais rapido possivel.', report: { _id: report._id } });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar denuncia' });
    }
});

// GET /api/reports — admin lista denuncias
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        var status = req.query.status || 'pending';
        var reports = await Report.find({ status: status })
            .populate('reporter', 'name email')
            .populate('reported', 'name email profilePhoto')
            .sort({ createdAt: -1 })
            .limit(100);
        var pendingCount = await Report.countDocuments({ status: 'pending' });
        res.json({ reports, pendingCount });
    } catch (e) {
        res.json({ reports: [], pendingCount: 0 });
    }
});

// PUT /api/reports/:id — admin resolve denuncia
router.put('/:id', validateId('id'), authMiddleware, adminMiddleware, async (req, res) => {
    try {
        var { action, adminNote } = req.body;
        if (!['resolved', 'dismissed'].includes(action)) {
            return res.status(400).json({ error: 'Acao invalida' });
        }

        var report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Denuncia nao encontrada' });

        report.status = action;
        report.adminNote = (adminNote || '').substring(0, 500);
        report.resolvedAt = new Date();
        await report.save();

        res.json({ message: 'Denuncia atualizada', report });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar denuncia' });
    }
});

module.exports = router;
