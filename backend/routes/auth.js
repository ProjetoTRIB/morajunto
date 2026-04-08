const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const connectDB = require('../config/db');
const emailService = require('../services/emailService');

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
        var { name, email, password, role, phone, cpf, birthDate, gender, profilePhoto, referralCode } = req.body;

        if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Nome muito longo (máximo 100 caracteres)' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        if (password.length > 1000) {
            return res.status(400).json({ error: 'Senha muito longa (máximo 1000 caracteres)' });
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

        // Gerar código de verificação de 6 dígitos
        var verificationCode = crypto.randomInt(100000, 999999).toString();
        var verificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

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
            emailVerified: false,
            verificationCode: verificationCode,
            verificationExpires: verificationExpires
        });

        // Handle referral code for agency users
        if (referralCode && role === 'agency') {
            try {
                var referrer = await User.findOne({ 'agentProfile.referralCode': referralCode.toUpperCase().trim(), role: 'agency' });
                if (referrer) {
                    await User.findByIdAndUpdate(user._id, { 'agentProfile.referredBy': referrer._id });
                }
            } catch (e) { console.error('Referral error:', e.message); }
        }

        // Enviar email de verificação (não bloqueia o registro se falhar)
        emailService.sendVerificationEmail(user.email, user.name, verificationCode);

        var token = generateToken(user);
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, cpf: user.cpf, gender: user.gender },
            emailVerified: false,
            message: 'Conta criada! Verifique seu email para confirmar.'
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
        if (password.length > 1000) {
            return res.status(400).json({ error: 'Senha muito longa' });
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

// POST /api/auth/change-password — trocar senha (autenticado)
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        var { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        var isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Senha atual incorreta' });

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: 'Nova senha deve ter 8+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Senha alterada com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// POST /api/auth/admin/seed — cria admin (apenas se nenhum admin existe, requer ADMIN_SEED_KEY)
router.post('/admin/seed', async (req, res) => {
    try {
        // Require seed key ALWAYS (not just production)
        var seedKey = process.env.ADMIN_SEED_KEY;
        if (!seedKey || !req.body.seedKey || req.body.seedKey !== seedKey) {
            return res.status(401).json({ error: 'Chave de seed inválida ou não configurada' });
        }

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

// ===== EMAIL VERIFICATION =====

// POST /api/auth/verify-email — confirmar email com código
router.post('/verify-email', authMiddleware, async function(req, res) {
    try {
        var { code } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Código de verificação é obrigatório' });
        }

        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (user.emailVerified) {
            return res.json({ message: 'Email já verificado', emailVerified: true });
        }

        if (!user.verificationCode || !user.verificationExpires) {
            return res.status(400).json({ error: 'Nenhum código pendente. Solicite um novo.' });
        }

        if (user.verificationExpires < new Date()) {
            return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
        }

        if (user.verificationCode !== code.trim()) {
            return res.status(400).json({ error: 'Código incorreto' });
        }

        user.emailVerified = true;
        user.verificationCode = undefined;
        user.verificationExpires = undefined;
        await user.save();

        res.json({ message: 'Email verificado com sucesso!', emailVerified: true });
    } catch (e) {
        console.error('Verify email error:', e.message);
        res.status(500).json({ error: 'Erro ao verificar email' });
    }
});

// POST /api/auth/resend-code — reenviar código de verificação
router.post('/resend-code', authMiddleware, async function(req, res) {
    try {
        var user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (user.emailVerified) {
            return res.json({ message: 'Email já verificado' });
        }

        var verificationCode = crypto.randomInt(100000, 999999).toString();
        user.verificationCode = verificationCode;
        user.verificationExpires = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();

        await emailService.sendVerificationEmail(user.email, user.name, verificationCode);

        res.json({ message: 'Código reenviado para ' + user.email });
    } catch (e) {
        console.error('Resend code error:', e.message);
        res.status(500).json({ error: 'Erro ao reenviar código' });
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

// In-memory store for OAuth state tokens (use Redis in production for multi-instance)
var oauthStates = new Map();
var OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutes

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

// POST request for token exchange (avoids sending client_secret in URL)
function httpsPost(hostname, path, body) {
    return new Promise(function(resolve, reject) {
        var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        var req = https.request({
            hostname: hostname,
            path: path,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) }
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

// GET /api/auth/facebook — redirect to Facebook login
router.get('/facebook', function(req, res) {
    var appId = process.env.FACEBOOK_APP_ID;
    var callback = process.env.FACEBOOK_CALLBACK_URL;
    if (!appId || appId === 'SEU_APP_ID_AQUI') {
        return res.status(503).json({ error: 'Facebook OAuth não configurado. Configure FACEBOOK_APP_ID no .env' });
    }

    // Generate secure random state token (CSRF protection)
    var stateToken = crypto.randomBytes(32).toString('hex');
    var userJwt = req.query.token || '';
    oauthStates.set(stateToken, { userJwt: userJwt, createdAt: Date.now() });

    // Cleanup expired states
    for (var [key, val] of oauthStates) {
        if (Date.now() - val.createdAt > OAUTH_STATE_TTL) oauthStates.delete(key);
    }

    var scope = 'public_profile,email';
    var url = 'https://www.facebook.com/v19.0/dialog/oauth?client_id=' + appId +
        '&redirect_uri=' + encodeURIComponent(callback) +
        '&scope=' + scope +
        '&state=' + encodeURIComponent(stateToken) +
        '&response_type=code';
    res.redirect(url);
});

// GET /api/auth/facebook/callback — handle Facebook redirect
router.get('/facebook/callback', async function(req, res) {
    var code = req.query.code;
    var stateToken = req.query.state || '';
    var error = req.query.error;

    if (error || !code) {
        return res.redirect('/?fb_error=denied');
    }

    // Validate state token (CSRF protection)
    var stateData = oauthStates.get(stateToken);
    if (!stateData || Date.now() - stateData.createdAt > OAUTH_STATE_TTL) {
        oauthStates.delete(stateToken);
        return res.redirect('/?fb_error=invalid_state');
    }
    oauthStates.delete(stateToken); // one-time use
    var userJwt = stateData.userJwt;

    var appId = process.env.FACEBOOK_APP_ID;
    var appSecret = process.env.FACEBOOK_APP_SECRET;
    var callback = process.env.FACEBOOK_CALLBACK_URL;

    try {
        // Exchange code for access token via POST (secure — no secret in URL)
        var tokenBody = 'client_id=' + appId +
            '&redirect_uri=' + encodeURIComponent(callback) +
            '&client_secret=' + appSecret +
            '&code=' + code;
        var tokenData = await httpsPost('graph.facebook.com', '/v19.0/oauth/access_token', tokenBody);

        if (!tokenData.access_token) {
            return res.redirect('/?fb_error=token_failed');
        }

        // Get user profile from Facebook
        var profileUrl = 'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=' + tokenData.access_token;
        var fbUser = await httpsGet(profileUrl);

        if (!fbUser.id) {
            return res.redirect('/?fb_error=profile_failed');
        }

        // Link to existing MoraJunto user (via saved JWT)
        if (userJwt) {
            try {
                var decoded = jwt.verify(userJwt, process.env.JWT_SECRET, { algorithms: ['HS256'] });
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
            // Login — set token as httpOnly cookie instead of URL parameter
            var token = generateToken(existingFb);
            res.cookie('fb_auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60000 // 1 minute — frontend should read and clear
            });
            return res.redirect('/?fb_success=login&fb_name=' + encodeURIComponent(existingFb.name));
        }

        // No linked account and no state token — redirect to register
        return res.redirect('/?fb_error=no_account&fb_name=' + encodeURIComponent(fbUser.name) + '&fb_id=' + fbUser.id);

    } catch (e) {
        console.error('Facebook OAuth error:', e.message);
        return res.redirect('/?fb_error=server');
    }
});

// GET /api/auth/fb-token — exchange httpOnly cookie for token (one-time use)
router.get('/fb-token', function(req, res) {
    var token = req.cookies && req.cookies.fb_auth_token;
    if (!token) return res.status(401).json({ error: 'No token' });
    // Clear the cookie immediately (one-time use)
    res.clearCookie('fb_auth_token');
    res.json({ token: token });
});

module.exports = router;
