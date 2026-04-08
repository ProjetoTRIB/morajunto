const express = require('express');
const router = express.Router();
const User = require('../models/User');
const RoommateGroup = require('../models/RoommateGroup');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

router.use(authMiddleware);

// PUT /profile — update roommate profile
router.put('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        const fields = ['bio', 'age', 'gender', 'occupation', 'university', 'salary', 'budget', 'moveDate',
            'neighborhood', 'cleanliness', 'noise', 'sleep', 'smoking', 'pets', 'visitors',
            'lookingFor', 'groupSize', 'photos', 'course', 'genderPreference', 'ageMin', 'ageMax'];

        if (!user.roommateProfile) user.roommateProfile = {};

        // Validate and sanitize each field
        var stringFields = { bio: 500, gender: 30, occupation: 100, university: 100, neighborhood: 100,
            smoking: 30, pets: 30, lookingFor: 100, course: 100, genderPreference: 30, sleep: 30 };
        var numericFields = { age: [18, 120], salary: [0, 100000], budget: [0, 50000],
            cleanliness: [1, 5], noise: [1, 5], visitors: [1, 5], groupSize: [1, 20],
            ageMin: [18, 120], ageMax: [18, 120] };

        for (var f of fields) {
            if (req.body[f] === undefined) continue;
            if (stringFields[f] !== undefined) {
                if (typeof req.body[f] !== 'string') continue;
                user.roommateProfile[f] = req.body[f].substring(0, stringFields[f]);
            } else if (numericFields[f]) {
                var val = Number(req.body[f]);
                if (isNaN(val)) continue;
                user.roommateProfile[f] = Math.max(numericFields[f][0], Math.min(val, numericFields[f][1]));
            } else if (f === 'moveDate') {
                if (typeof req.body[f] === 'string' && req.body[f].length <= 20) user.roommateProfile[f] = req.body[f];
            } else if (f === 'photos') {
                if (Array.isArray(req.body[f])) {
                    user.roommateProfile[f] = req.body[f].filter(function(p) { return typeof p === 'string'; }).slice(0, 10).map(function(p) { return p.substring(0, 500); });
                }
            } else {
                user.roommateProfile[f] = req.body[f];
            }
        }

        if (req.body.active !== undefined) user.roommateProfile.active = !!req.body.active;
        if (req.body.facebookUrl !== undefined && typeof req.body.facebookUrl === 'string') user.facebookUrl = req.body.facebookUrl.substring(0, 200);
        if (req.body.instagramUrl !== undefined && typeof req.body.instagramUrl === 'string') user.instagramUrl = req.body.instagramUrl.substring(0, 200);

        await user.save();
        res.json({ profile: user.roommateProfile, socialVerified: user.socialVerified });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar perfil' });
    }
});

// GET /profile — get own roommate profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({
            roommateProfile: user.roommateProfile || {},
            facebookUrl: user.facebookUrl,
            instagramUrl: user.instagramUrl,
            socialVerified: user.socialVerified,
            name: user.name
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// POST /verify-social — verify social media URLs
router.post('/verify-social', async (req, res) => {
    try {
        const { facebookUrl, instagramUrl } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Validate Instagram: must contain instagram.com/username (not just instagram.com/)
        let hasIg = false;
        let igHandle = '';
        if (instagramUrl) {
            const igMatch = instagramUrl.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
            if (igMatch && igMatch[1] && igMatch[1] !== '') {
                hasIg = true;
                igHandle = igMatch[1];
            }
        }

        // Validate Facebook: must contain facebook.com/username
        let hasFb = false;
        let fbHandle = '';
        if (facebookUrl) {
            const fbMatch = facebookUrl.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9._]+)/);
            if (fbMatch && fbMatch[1] && fbMatch[1] !== '') {
                hasFb = true;
                fbHandle = fbMatch[1];
            }
        }

        if (!hasFb && !hasIg) {
            return res.status(400).json({ error: 'Informe pelo menos um perfil válido do Facebook ou Instagram (com nome de usuário)', verified: false });
        }

        if (hasFb) {
            user.facebookUrl = facebookUrl;
            user.facebookHandle = fbHandle;
        }
        if (hasIg) {
            user.instagramUrl = instagramUrl;
            user.instagramHandle = igHandle;
            // Try to extract profile photo hint from Instagram
            if (!user.profilePhoto) {
                user.profilePhoto = `https://instagram.com/${igHandle}`;
            }
        }

        user.socialVerified = true;
        await user.save();

        res.json({
            verified: true,
            message: 'Redes sociais verificadas!',
            instagramHandle: user.instagramHandle,
            facebookHandle: user.facebookHandle,
            profilePhoto: user.profilePhoto
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao verificar' });
    }
});

// GET /discover — find compatible profiles
router.get('/discover', async (req, res) => {
    try {
        const me = await User.findById(req.user.userId);
        if (!me || !me.roommateProfile || !me.roommateProfile.active) {
            return res.json({ profiles: [] });
        }

        const excludeIds = [me._id, ...(me.likedProfiles || []), ...(me.dislikedProfiles || [])];
        const myP = me.roommateProfile;

        // Build query with filters
        const query = {
            _id: { $nin: excludeIds },
            'roommateProfile.active': true
        };

        // Gender preference filter
        if (myP.genderPreference === 'mesmo' && myP.gender) {
            query['roommateProfile.gender'] = myP.gender;
        } else if (myP.genderPreference === 'feminino') {
            query['roommateProfile.gender'] = 'feminino';
        } else if (myP.genderPreference === 'masculino') {
            query['roommateProfile.gender'] = 'masculino';
        } else if (myP.genderPreference === 'neutro') {
            query['roommateProfile.gender'] = { $in: ['nao-binario', 'outro'] };
        }

        // Age range filter
        const ageMin = myP.ageMin || 18;
        const ageMax = myP.ageMax || 40;
        query['roommateProfile.age'] = { $gte: ageMin, $lte: ageMax };

        const candidates = await User.find(query).select('-password -verificationCode').limit(50);

        const scored = candidates.map(c => {
            const cp = c.roommateProfile || {};
            let score = 0;

            // Same neighborhood (+30)
            if (myP.neighborhood && cp.neighborhood && myP.neighborhood === cp.neighborhood) score += 30;

            // Budget within 20% (+25)
            if (myP.budget > 0 && cp.budget > 0) {
                const diff = Math.abs(myP.budget - cp.budget) / Math.max(myP.budget, cp.budget);
                if (diff <= 0.2) score += 25;
                else if (diff <= 0.4) score += 12;
            }

            // Cleanliness within 1 (+15)
            if (Math.abs((myP.cleanliness || 3) - (cp.cleanliness || 3)) <= 1) score += 15;

            // Noise within 1 (+10)
            if (Math.abs((myP.noise || 3) - (cp.noise || 3)) <= 1) score += 10;

            // Same sleep (+10)
            if (myP.sleep && cp.sleep && (myP.sleep === cp.sleep || myP.sleep === 'tanto_faz' || cp.sleep === 'tanto_faz')) score += 10;

            // Same smoking (+10)
            if (myP.smoking === cp.smoking) score += 10;

            // Same gender (+10)
            if (myP.gender && cp.gender && myP.gender === cp.gender) score += 10;

            // Same pets (+5)
            if (myP.pets === cp.pets) score += 5;

            // Social verified (+15)
            if (c.socialVerified) score += 15;

            // Identity verified (+20)
            if (c.identityVerification && c.identityVerification.status === 'approved') score += 20;

            // Urgency boost (+50)
            if (cp.urgentUntil && new Date(cp.urgentUntil) > new Date()) score += 50;

            // Same course/university (+20)
            if (myP.course && cp.course && myP.course.toLowerCase() === cp.course.toLowerCase()) score += 10;
            if (myP.university && cp.university && myP.university.toLowerCase() === cp.university.toLowerCase()) score += 10;

            // Gender preference match (+15)
            if (myP.genderPreference === 'mesmo' && myP.gender && cp.gender && myP.gender === cp.gender) score += 15;

            // Age within preferred range (+10)
            if (cp.age && cp.age >= ageMin && cp.age <= ageMax) score += 10;

            const compatibility = Math.min(100, Math.round((score / 255) * 100));

            return {
                _id: c._id,
                name: c.name,
                roommateProfile: cp,
                socialVerified: c.socialVerified,
                profilePhoto: c.profilePhoto,
                identityVerification: c.identityVerification ? { status: c.identityVerification.status } : { status: 'none' },
                score,
                compatibility
            };
        });

        scored.sort((a, b) => b.score - a.score);
        res.json({ profiles: scored.slice(0, 20) });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar perfis' });
    }
});

// POST /like/:userId
router.post('/like/:userId', validateId('userId'), async (req, res) => {
    try {
        const me = await User.findById(req.user.userId);
        const other = await User.findById(req.params.userId);
        if (!me || !other) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (!(me.likedProfiles || []).includes(other._id)) {
            if (!me.likedProfiles) me.likedProfiles = [];
            me.likedProfiles.push(other._id);
            await me.save();
        }

        // Check mutual
        const mutual = other.likedProfiles && other.likedProfiles.includes(me._id);
        if (mutual) {
            if (!me.matches.includes(other._id)) {
                me.matches.push(other._id);
                await me.save();
            }
            if (!other.matches.includes(me._id)) {
                other.matches.push(me._id);
                await other.save();
            }

            // Notify both users about the match
            try {
                await Notification.create({
                    user: me._id, type: 'roommate_match',
                    title: 'Novo match!',
                    message: 'Voce e ' + other.name + ' deram match! Comece uma conversa.',
                    metadata: { matchedUserId: other._id }
                });
                await Notification.create({
                    user: other._id, type: 'roommate_match',
                    title: 'Novo match!',
                    message: 'Voce e ' + me.name + ' deram match! Comece uma conversa.',
                    metadata: { matchedUserId: me._id }
                });
            } catch (notifErr) { console.error('Match notification error:', notifErr.message); }

            return res.json({ match: true, user: { _id: other._id, name: other.name, roommateProfile: other.roommateProfile } });
        }

        res.json({ match: false, message: 'Interesse registrado!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao registrar interesse' });
    }
});

// POST /dislike/:userId
router.post('/dislike/:userId', validateId('userId'), async (req, res) => {
    try {
        const me = await User.findById(req.user.userId);
        if (!me) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (!(me.dislikedProfiles || []).includes(req.params.userId)) {
            if (!me.dislikedProfiles) me.dislikedProfiles = [];
            me.dislikedProfiles.push(req.params.userId);
            await me.save();
        }

        res.json({ message: 'Perfil pulado' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao pular perfil' });
    }
});

// GET /matches
router.get('/matches', async (req, res) => {
    try {
        const me = await User.findById(req.user.userId).populate('matches', '-password -verificationCode');
        res.json({ matches: me.matches || [] });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar matches' });
    }
});

// POST /groups — create group
router.post('/groups', async (req, res) => {
    try {
        const { matchUserId } = req.body;
        if (!matchUserId || typeof matchUserId !== 'string' || !/^[a-f\d]{24}$/i.test(matchUserId)) {
            return res.status(400).json({ error: 'ID do match inválido' });
        }
        const me = await User.findById(req.user.userId);
        const other = await User.findById(matchUserId);
        if (!me || !other) return res.status(404).json({ error: 'Usuário não encontrado' });

        const myBudget = (me.roommateProfile && me.roommateProfile.budget) || 0;
        const otherBudget = (other.roommateProfile && other.roommateProfile.budget) || 0;
        const total = myBudget + otherBudget;
        const split = Math.round(total / 2);

        const group = await RoommateGroup.create({
            members: [me._id, other._id],
            totalBudget: total,
            splitAmount: split,
            neighborhood: (me.roommateProfile && me.roommateProfile.neighborhood) || '',
            status: 'forming'
        });

        res.status(201).json({ group });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar grupo' });
    }
});

// GET /groups
router.get('/groups', async (req, res) => {
    try {
        const groups = await RoommateGroup.find({ members: req.user.userId })
            .populate('members', 'name roommateProfile')
            .populate('property', 'title price neighborhood')
            .sort({ createdAt: -1 });
        res.json({ groups });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar grupos' });
    }
});

// GET /groups/:id
router.get('/groups/:id', validateId('id'), async (req, res) => {
    try {
        const group = await RoommateGroup.findById(req.params.id)
            .populate('members', 'name roommateProfile')
            .populate('property', 'title price neighborhood images');
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });
        res.json({ group });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar grupo' });
    }
});

// POST /groups/:id/chat
router.post('/groups/:id/chat', validateId('id'), async (req, res) => {
    try {
        const group = await RoommateGroup.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

        // Membership check
        if (!group.members.some(m => m.toString() === req.user.userId)) {
            return res.status(403).json({ error: 'Você não é membro deste grupo' });
        }

        var msg = (req.body.message || '').trim().substring(0, 2000);
        if (!msg) return res.status(400).json({ error: 'Mensagem vazia' });

        const user = await User.findById(req.user.userId);
        group.chat.push({
            user: req.user.userId,
            userName: user ? user.name : 'Usuário',
            message: msg
        });
        await group.save();

        res.json({ message: 'Mensagem enviada' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// POST /groups/:id/property
router.post('/groups/:id/property', validateId('id'), async (req, res) => {
    try {
        const group = await RoommateGroup.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

        // Membership check
        if (!group.members.some(m => m.toString() === req.user.userId)) {
            return res.status(403).json({ error: 'Você não é membro deste grupo' });
        }

        if (!req.body.propertyId || typeof req.body.propertyId !== 'string' || !/^[a-f\d]{24}$/i.test(req.body.propertyId)) {
            return res.status(400).json({ error: 'ID do imóvel inválido' });
        }
        group.property = req.body.propertyId;
        group.status = 'found';
        await group.save();

        res.json({ message: 'Imóvel vinculado ao grupo' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao vincular imóvel' });
    }
});

// POST /urgent — activate urgency mode (7 days)
router.post('/urgent', async (req, res) => {
    try {
        var user = await User.findById(req.user.userId);
        if (!user || !user.roommateProfile || !user.roommateProfile.active) {
            return res.status(400).json({ error: 'Ative seu perfil de roommate primeiro' });
        }
        if (user.roommateProfile.urgentUntil && user.roommateProfile.urgentUntil > new Date()) {
            var daysLeft = Math.ceil((user.roommateProfile.urgentUntil - Date.now()) / (24 * 60 * 60 * 1000));
            return res.status(400).json({ error: 'Modo urgencia ja ativo (' + daysLeft + ' dias restantes)', urgentUntil: user.roommateProfile.urgentUntil });
        }

        var urgentUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        user.roommateProfile.urgentUntil = urgentUntil;
        await user.save();

        // Notify online users via socket
        var io = req.app.get('io');
        var onlineUsers = req.app.get('onlineUsers');
        if (io && onlineUsers) {
            onlineUsers.forEach(function(socketId, userId) {
                if (userId !== req.user.userId) {
                    io.to(socketId).emit('urgent-user', { userId: user._id, name: user.name, urgentUntil: urgentUntil });
                }
            });
        }

        res.json({ urgentUntil: urgentUntil, message: 'Modo urgencia ativado por 7 dias! Seu perfil sera destacado.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao ativar modo urgencia' });
    }
});

// GET /stats
router.get('/stats', async (req, res) => {
    try {
        const activeProfiles = await User.countDocuments({ 'roommateProfile.active': true });
        const totalGroups = await RoommateGroup.countDocuments();
        res.json({ activeProfiles, totalGroups });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar stats' });
    }
});

module.exports = router;
