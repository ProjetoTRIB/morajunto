const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');
const { createStorage } = require('../config/cloudinary');
const { verifyFaces } = require('../services/faceVerifyService');
const emailService = require('../services/emailService');

var upload = multer({
    storage: createStorage('morajunto/verification'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Upload de foto de perfil
var profileUpload = multer({
    storage: createStorage('morajunto/profiles'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/verification/profile-photo — Upload foto de perfil
router.post('/profile-photo', authMiddleware, profileUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Envie uma foto' });

        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        user.profilePhoto = req.file.path;
        await user.save();

        res.json({ success: true, photoUrl: req.file.path });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar foto de perfil' });
    }
});

// POST /api/verification/submit — upload selfie + documento com verificação automática por IA
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

        var selfieUrl = req.files.selfie[0].path;
        var documentUrl = req.files.document[0].path;

        user.identityVerification = {
            status: 'pending',
            selfieUrl: selfieUrl,
            documentUrl: documentUrl,
            submittedAt: new Date(),
            rejectionReason: ''
        };
        await user.save();

        // Verificação automática por IA (em background — não bloqueia resposta)
        res.json({ message: 'Documentos enviados! Analisando automaticamente...', status: 'pending' });

        // Processar em background
        (async function() {
            try {
                var result = await verifyFaces(selfieUrl, documentUrl);
                console.log('[VERIFY] Resultado IA para ' + user.name + ':', JSON.stringify(result));

                var userReload = await User.findById(user._id);
                if (!userReload) return;

                if (result.approved) {
                    // Auto-aprovado pela IA
                    userReload.identityVerification.status = 'approved';
                    userReload.identityVerification.reviewedAt = new Date();
                    userReload.identityVerification.rejectionReason = '';
                    // Também usar a selfie como foto de perfil se não tiver
                    if (!userReload.profilePhoto) {
                        userReload.profilePhoto = selfieUrl;
                    }
                    await userReload.save();

                    // Notificar
                    await Notification.create({
                        user: userReload._id, type: 'verification_approved',
                        title: 'Identidade verificada!',
                        message: 'Sua verificação foi aprovada automaticamente. Seu perfil agora tem o selo verificado!',
                        metadata: { confidence: result.confidence, documentType: result.documentType }
                    });
                    emailService.sendVerificationStatusEmail(userReload.email, userReload.name, 'approved');
                    console.log('[VERIFY] Auto-aprovado: ' + userReload.name + ' (confiança: ' + result.confidence + '%)');

                } else if (result.needsManualReview) {
                    // Confiança média — manter como pendente para admin revisar
                    userReload.identityVerification.rejectionReason = 'IA: ' + result.reason + ' (confiança: ' + result.confidence + '%)';
                    await userReload.save();
                    console.log('[VERIFY] Revisão manual necessária: ' + userReload.name + ' — ' + result.reason);

                } else {
                    // Auto-rejeitado (confiança muito baixa)
                    userReload.identityVerification.status = 'rejected';
                    userReload.identityVerification.reviewedAt = new Date();
                    userReload.identityVerification.rejectionReason = result.reason || 'Não foi possível verificar sua identidade. Envie fotos mais claras.';
                    await userReload.save();

                    await Notification.create({
                        user: userReload._id, type: 'verification_rejected',
                        title: 'Verificação não aprovada',
                        message: result.reason || 'Envie fotos mais claras e tente novamente.',
                        metadata: { confidence: result.confidence }
                    });
                    emailService.sendVerificationStatusEmail(userReload.email, userReload.name, 'rejected', result.reason);
                    console.log('[VERIFY] Auto-rejeitado: ' + userReload.name + ' — ' + result.reason);
                }
            } catch (bgErr) {
                console.error('[VERIFY] Erro background:', bgErr.message);
            }
        })();
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
