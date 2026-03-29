const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

var storage = multer.diskStorage({
    destination: './uploads/verification/',
    filename: function(req, file, cb) {
        var ext = path.extname(file.originalname).toLowerCase();
        cb(null, req.user.userId + '-' + file.fieldname + '-' + Date.now() + ext);
    }
});

function imageFilter(req, file, cb) {
    var allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    var ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens JPG, PNG ou WebP'), false);
    }
}

var upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFilter
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
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        if (user.identityVerification && user.identityVerification.status === 'pending') {
            return res.status(400).json({ error: 'Verificacao ja esta em analise' });
        }
        if (user.identityVerification && user.identityVerification.status === 'approved') {
            return res.status(400).json({ error: 'Identidade ja foi verificada' });
        }

        user.identityVerification = {
            status: 'pending',
            selfieUrl: '/uploads/verification/' + req.files.selfie[0].filename,
            documentUrl: '/uploads/verification/' + req.files.document[0].filename,
            submittedAt: new Date(),
            rejectionReason: ''
        };
        await user.save();

        res.json({ message: 'Documentos enviados! Vamos analisar em ate 24 horas.', status: 'pending' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar documentos' });
    }
});

// GET /api/verification/status — status da verificacao
router.get('/status', authMiddleware, async (req, res) => {
    try {
        var user = await User.findById(req.user.userId).select('identityVerification socialVerified');
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
        res.json({
            identityVerification: user.identityVerification || { status: 'none' },
            socialVerified: user.socialVerified || false
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

module.exports = router;
