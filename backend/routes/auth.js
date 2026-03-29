const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const connectDB = require('../config/db');

function requireDB(req, res, next) {
    if (!connectDB.isConnected()) return res.status(503).json({ error: 'Banco de dados não disponível.' });
    next();
}

router.use(requireDB);

function generateToken(user) {
    return jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h', algorithm: 'HS256' }
    );
}

function isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function isStrongPassword(password) {
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
    var common = ['password', '12345678', 'qwerty123', 'admin123', 'alugaja', 'morajunto'];
    if (common.some(function(c) { return password.toLowerCase().includes(c); })) return false;
    return true;
}

var MAX_LOGIN_ATTEMPTS = 5;
var LOCK_TIME = 15 * 60 * 1000; // 15 minutes

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    // Reject sequences like 111.111.111-11
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    // First digit
    var sum = 0;
    for (var i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    var d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(cpf.charAt(9)) !== d1) return false;
    // Second digit
    sum = 0;
    for (var i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    var d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    if (parseInt(cpf.charAt(10)) !== d2) return false;
    return true;
}

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// POST /api/auth/register — cria conta (user ou agency)
router.post('/register', async (req, res) => {
    try {
        var { name, email, password, role, phone, cpf, birthDate, gender, profilePhoto } = req.body;

        if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres, 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial' });
        }

        // CPF obrigatório e validação
        if (!cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório' });
        }
        if (!validateCPF(cpf)) {
            return res.status(400).json({ error: 'CPF inválido. Verifique os dígitos.' });
        }
        var cpfFormatted = formatCPF(cpf);
        var existingCPF = await User.findOne({ cpf: cpfFormatted });
        if (existingCPF) {
            return res.status(400).json({ error: 'CPF já cadastrado' });
        }

        // Data de nascimento obrigatória
        if (!birthDate) {
            return res.status(400).json({ error: 'Data de nascimento é obrigatória' });
        }
        var birth = new Date(birthDate);
        var age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) {
            return res.status(400).json({ error: 'Você precisa ter pelo menos 18 anos' });
        }
        if (age > 120) {
            return res.status(400).json({ error: 'Data de nascimento inválida' });
        }

        // Permitir user, owner ou agency no registro (admin só via seed)
        if (role && !['user', 'owner', 'agency'].includes(role)) {
            role = 'user';
        }
        if (!role) role = 'user';

        var existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        var hash = await bcrypt.hash(password, 10);
        var user = await User.create({
            name: name.trim().replace(/<[^>]*>/g, ''),
            email: email.toLowerCase().trim(),
            password: hash,
            role: role,
            phone: phone || '',
            cpf: cpfFormatted,
            birthDate: birth,
            gender: gender || '',
            profilePhoto: (profilePhoto || '').trim(),
            emailVerified: true
        });

        var token = generateToken(user);
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, cpf: user.cpf, gender: user.gender }
        });
    } catch (e) {
        console.error('Register error:', e.message);
        res.status(500).json({ error: 'Erro ao criar conta' });
    }
});

// POST /api/auth/login — with account lockout protection
router.post('/login', async (req, res) => {
    try {
        var { email, password } = req.body;

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        var user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            var minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(423).json({ error: 'Conta bloqueada. Tente novamente em ' + minutesLeft + ' minutos.' });
        }

        // Reset lock if expired
        if (user.lockUntil && user.lockUntil <= Date.now()) {
            user.loginAttempts = 0;
            user.lockUntil = undefined;
        }

        var valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            // Increment failed attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                user.lockUntil = new Date(Date.now() + LOCK_TIME);
                await user.save();
                return res.status(423).json({ error: 'Conta bloqueada por 15 minutos após ' + MAX_LOGIN_ATTEMPTS + ' tentativas incorretas.' });
            }
            await user.save();
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Login success — reset attempts
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();
        await user.save();

        var token = generateToken(user);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        var user = await User.findById(req.user.userId).select('-password -verificationCode');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            favorites: user.favorites,
            gender: user.gender || '',
            socialVerified: user.socialVerified || false,
            instagramHandle: user.instagramHandle || '',
            facebookHandle: user.facebookHandle || '',
            profilePhoto: user.profilePhoto || '',
            cpf: user.cpf || '',
            birthDate: user.birthDate,
            createdAt: user.createdAt
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// POST /api/auth/admin/seed — cria admin (apenas se nenhum admin existe)
router.post('/admin/seed', async (req, res) => {
    try {
        // Block if any admin already exists
        var existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(403).json({ error: 'Admin ja existe. Use o painel admin.' });
        }

        var email = process.env.ADMIN_EMAIL;
        var password = process.env.ADMIN_PASSWORD;
        if (!email || !password) {
            return res.status(400).json({ error: 'ADMIN_EMAIL e ADMIN_PASSWORD devem estar no .env' });
        }

        var hash = await bcrypt.hash(password, 10);
        var user = await User.create({
            name: 'Administrador',
            email: email.toLowerCase().trim(),
            password: hash,
            role: 'admin',
            emailVerified: true
        });

        res.status(201).json({ message: 'Admin criado com sucesso', user: { id: user._id, email: user.email } });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar admin' });
    }
});

// ===== INSTAGRAM HANDLE VERIFICATION =====
router.post('/verify-instagram', authMiddleware, async function(req, res) {
    try {
        var handle = (req.body.handle || '').replace('@', '').trim().substring(0, 30);
        if (!handle || !/^[a-zA-Z0-9._]+$/.test(handle)) {
            return res.status(400).json({ error: 'Handle do Instagram inválido' });
        }
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        user.instagramHandle = handle;
        user.instagramUrl = 'https://instagram.com/' + handle;
        await user.save();

        res.json({ success: true, handle: handle });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao salvar Instagram' });
    }
});

// ===== FACEBOOK OAUTH =====
var https = require('https');

function httpsGet(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// GET /api/auth/facebook — redirect to Facebook login
router.get('/facebook', function(req, res) {
    var appId = process.env.FACEBOOK_APP_ID;
    var callback = process.env.FACEBOOK_CALLBACK_URL;
    if (!appId || appId === 'SEU_APP_ID_AQUI') {
        return res.status(503).json({ error: 'Facebook OAuth não configurado. Configure FACEBOOK_APP_ID no .env' });
    }

    // Save the user's token in state so we can link accounts
    var state = req.query.token || '';
    var scope = 'public_profile,email';
    var url = 'https://www.facebook.com/v19.0/dialog/oauth?client_id=' + appId +
        '&redirect_uri=' + encodeURIComponent(callback) +
        '&scope=' + scope +
        '&state=' + encodeURIComponent(state) +
        '&response_type=code';
    res.redirect(url);
});

// GET /api/auth/facebook/callback — handle Facebook redirect
router.get('/facebook/callback', async function(req, res) {
    var code = req.query.code;
    var state = req.query.state || '';
    var error = req.query.error;

    if (error || !code) {
        return res.redirect('/?fb_error=denied');
    }

    var appId = process.env.FACEBOOK_APP_ID;
    var appSecret = process.env.FACEBOOK_APP_SECRET;
    var callback = process.env.FACEBOOK_CALLBACK_URL;

    try {
        // Exchange code for access token
        var tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token?client_id=' + appId +
            '&redirect_uri=' + encodeURIComponent(callback) +
            '&client_secret=' + appSecret +
            '&code=' + code;
        var tokenData = await httpsGet(tokenUrl);

        if (!tokenData.access_token) {
            return res.redirect('/?fb_error=token_failed');
        }

        // Get user profile from Facebook
        var profileUrl = 'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=' + tokenData.access_token;
        var fbUser = await httpsGet(profileUrl);

        if (!fbUser.id) {
            return res.redirect('/?fb_error=profile_failed');
        }

        // Link to existing MoraJunto user (via state token)
        if (state) {
            try {
                var decoded = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
                var user = await User.findById(decoded.userId);
                if (user) {
                    user.facebookId = fbUser.id;
                    user.facebookHandle = fbUser.name;
                    user.facebookUrl = 'https://facebook.com/' + fbUser.id;
                    user.socialVerified = true;
                    user.facebookVerifiedAt = new Date();
                    if (fbUser.picture && fbUser.picture.data && fbUser.picture.data.url && !user.profilePhoto) {
                        user.profilePhoto = fbUser.picture.data.url;
                    }
                    await user.save();
                    return res.redirect('/?fb_success=linked&fb_name=' + encodeURIComponent(fbUser.name));
                }
            } catch(e) {}
        }

        // Check if Facebook account already linked to a user
        var existingFb = await User.findOne({ facebookId: fbUser.id });
        if (existingFb) {
            // Login with existing account
            var token = generateToken(existingFb);
            return res.redirect('/?fb_success=login&token=' + token + '&fb_name=' + encodeURIComponent(existingFb.name));
        }

        // No linked account and no state token — redirect to register
        return res.redirect('/?fb_error=no_account&fb_name=' + encodeURIComponent(fbUser.name) + '&fb_id=' + fbUser.id);

    } catch (e) {
        console.error('Facebook OAuth error:', e.message);
        return res.redirect('/?fb_error=server');
    }
});

module.exports = router;
