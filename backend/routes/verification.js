const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { createStorage } = require('../config/cloudinary');

var upload = multer({
    storage: createStorage('morajunto/verification'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/verification/submit — upload selfie + documento
router.post('/submit', authMiddleware, upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'document', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.selfie || !req.files.document) {
            return res.status(400).json({ error: 'Envie a selfie e o documento (RG ou CPF)' });
        }

        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (user.identityVerification && user.identityVerification.status === 'pending') {
            return res.status(400).json({ error: 'Verificação já está em análise' });
        }
        if (user.identityVerification && user.identityVerification.status === 'approved') {
            return res.status(400).json({ error: 'Identidade já foi verificada' });
        }

        user.identityVerification = {
            status: 'pending',
            selfieUrl: req.files.selfie[0].path,
            documentUrl: req.files.document[0].path,
            submittedAt: new Date(),
            rejectionReason: ''
        };
        await user.save();

        res.json({ message: 'Documentos enviados! Vamos analisar em até 24 horas.', status: 'pending' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar documentos' });
    }
});

// GET /api/verification/status — status da verificacao
router.get('/status', authMiddleware, async (req, res) => {
    try {
        var user = await User.findById(req.user.userId).select('identityVerification socialVerified');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({
            identityVerification: user.identityVerification || { status: 'none' },
            socialVerified: user.socialVerified || false
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

module.exports = router;
