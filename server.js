// ===== MoraJunto — Backend Express + MongoDB =====
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// mongoSanitize removed — incompatible with Express 5, using manual sanitization
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./backend/config/db');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];

const io = new Server(server, { cors: { origin: ALLOWED_ORIGINS, credentials: true } });
const PORT = process.env.PORT || 3000;

// Socket.io auth + rooms
const onlineUsers = new Map();
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Auth required'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        socket.userId = decoded.userId;
        next();
    } catch { next(new Error('Invalid token')); }
});
io.on('connection', (socket) => {
    onlineUsers.set(socket.userId, socket.id);

    socket.on('typing', async (data) => {
        if (!data.conversationId || !data.recipientId) return;
        const recipientSocket = onlineUsers.get(data.recipientId);
        if (recipientSocket) {
            io.to(recipientSocket).emit('typing', {
                conversationId: data.conversationId,
                userId: socket.userId
            });
        }
    });
    socket.on('stop-typing', (data) => {
        if (!data.conversationId || !data.recipientId) return;
        const recipientSocket = onlineUsers.get(data.recipientId);
        if (recipientSocket) {
            io.to(recipientSocket).emit('stop-typing', { conversationId: data.conversationId });
        }
    });
    socket.on('disconnect', () => {
        onlineUsers.delete(socket.userId);
    });
});
// Make io and onlineUsers accessible to routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// ===== SECURITY MIDDLEWARE =====

// Helmet — HTTP security headers (XSS, clickjacking, HSTS, etc.)
var cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.groq.com", "https://api.mercadopago.com", "https://graph.facebook.com", "wss:", "ws:"],
    frameSrc: ["'self'", "https://www.openstreetmap.org", "https://www.facebook.com"],
};
if (process.env.NODE_ENV !== 'production') {
    cspDirectives.upgradeInsecureRequests = null;
    cspDirectives.imgSrc = ["'self'", "data:", "https:", "http:"];
}
app.use(helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));

// Cookie parser (for OAuth token cookies)
app.use(cookieParser());

// Body parser with size limit (prevent large payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Ensure UTF-8 charset on all JSON responses
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return originalJson(data);
    };
    next();
});

// Manual NoSQL injection + prototype pollution prevention
app.use(function(req, res, next) {
    var BLOCKED_KEYS = ['__proto__', 'constructor', 'prototype'];
    function sanitize(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) { obj.forEach(sanitize); return obj; }
        for (var key in obj) {
            if (BLOCKED_KEYS.includes(key)) { delete obj[key]; continue; }
            if (key.startsWith('$')) { delete obj[key]; continue; }
            if (typeof obj[key] === 'string' && obj[key].startsWith('$')) {
                delete obj[key]; continue;
            }
            if (typeof obj[key] === 'object') sanitize(obj[key]);
        }
        return obj;
    }
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
});

// XSS sanitization — strip HTML tags from string inputs (body, query, params)
app.use(function(req, res, next) {
    function stripTags(obj) {
        if (!obj || typeof obj !== 'object') return;
        for (var key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].replace(/<[^>]*>/g, '');
            } else if (typeof obj[key] === 'object') {
                stripTags(obj[key]);
            }
        }
    }
    if (req.body) stripTags(req.body);
    if (req.query) stripTags(req.query);
    if (req.params) stripTags(req.params);
    next();
});

// HPP — prevent HTTP parameter pollution
app.use(hpp());

// HTTPS enforcement in production (before static files and routes)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect('https://' + req.hostname + req.url);
        }
        next();
    });
}

// Rate limiter — general (100 requests per minute per IP)
var generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', generalLimiter);

// Rate limiter — auth (strict: 10 attempts per 15 minutes)
var authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limiter — payments (strict: 20 per minute)
var paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Muitas requisições de pagamento. Aguarde.' }
});
app.use('/api/payments/', paymentLimiter);

// Rate limiter — search (10 per minute, calls external AI API)
var searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Muitas buscas. Aguarde 1 minuto.' }
});
app.use('/api/search', searchLimiter);

// Rate limiter — chat (30 per minute)
var chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Muitas mensagens. Aguarde.' }
});
app.use('/api/chat', chatLimiter);

// Serve PWA files before blocking middleware
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));

// Block sensitive files and backend source code
app.use(function(req, res, next) {
    var blocked = ['.env', '.git', 'package.json', 'package-lock.json', 'node_modules', 'backend', 'server.js'];
    var reqPath = req.path.toLowerCase();
    for (var b of blocked) {
        if (reqPath === '/' + b || reqPath.startsWith('/' + b + '/') || reqPath.includes('/.' )) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
    }
    next();
});

// Serve uploaded files — verification docs require admin auth
app.use('/uploads/verification', function(req, res, next) {
    var authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Acesso negado' });
    try {
        var token = authHeader.split(' ')[1];
        var decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
        next();
    } catch(e) { return res.status(401).json({ error: 'Token inválido' }); }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Arquivos estáticos — only serve frontend files, not source code
app.use(express.static(path.join(__dirname), {
    dotfiles: 'deny',
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
        else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
}));


// Ensure upload directories exist
var fs = require('fs');
fs.mkdirSync('./uploads/verification/', { recursive: true });

// Rotas da API
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/properties', require('./backend/routes/properties'));
app.use('/api/agencies', require('./backend/routes/agencies'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/search', require('./backend/routes/search'));
app.use('/api/roommate', require('./backend/routes/roommate'));
app.use('/api/republicas', require('./backend/routes/republicas'));
app.use('/api/owner', require('./backend/routes/owner'));
app.use('/api/tenant', require('./backend/routes/tenant'));
app.use('/api/payments', require('./backend/routes/payments'));
app.use('/api/chat', require('./backend/routes/chat'));
app.use('/api/reports', require('./backend/routes/reports'));
app.use('/api/verification', require('./backend/routes/verification'));
app.use('/api/agent-rewards', require('./backend/routes/agentRewards'));
app.use('/api/referrals', require('./backend/routes/referrals'));

// Public stats (homepage)
app.get('/api/stats', async (req, res) => {
    try {
        const Property = require('./backend/models/Property');
        const User = require('./backend/models/User');
        const properties = await Property.countDocuments({ status: 'active' });
        const agencies = await User.countDocuments({ role: 'agency' });
        const neighborhoods = await Property.distinct('neighborhood').then(n => n.filter(Boolean).length);
        res.json({ properties: properties || 0, agencies: agencies || 0, neighborhoods: neighborhoods || 0 });
    } catch (e) { res.json({ properties: 0, agencies: 0, neighborhoods: 0 }); }
});

// Agency endpoints (authenticated)
const authMw = require('./backend/middleware/auth');
app.get('/api/agency/stats', authMw, async (req, res) => {
    try {
        const Property = require('./backend/models/Property');
        const Lead = require('./backend/models/Lead');
        const properties = await Property.countDocuments({ agency: req.user.userId });
        const leads = await Lead.countDocuments({ agency: req.user.userId });
        const props = await Property.find({ agency: req.user.userId });
        const views = props.reduce((sum, p) => sum + (p.views || 0), 0);
        res.json({ properties, leads, views });
    } catch (e) { res.json({ properties: 0, leads: 0, views: 0 }); }
});
app.get('/api/agency/properties', authMw, async (req, res) => {
    try {
        const Property = require('./backend/models/Property');
        const properties = await Property.find({ agency: req.user.userId }).sort({ createdAt: -1 });
        res.json({ properties });
    } catch (e) { res.json({ properties: [] }); }
});
app.get('/api/agency/leads', authMw, async (req, res) => {
    try {
        const Lead = require('./backend/models/Lead');
        const leads = await Lead.find({ agency: req.user.userId }).populate('property', 'title').sort({ createdAt: -1 });
        res.json({ leads });
    } catch (e) { res.json({ leads: [] }); }
});

// Health check
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        db: connectDB.isConnected(),
        groq: !!process.env.GROQ_API_KEY
    });
});

// SPA fallback — reject path traversal attempts
app.get('/{*splat}', (req, res) => {
    if (req.path.includes('..') || req.path.includes('%2e') || req.path.includes('%2E')) {
        return res.status(400).json({ error: 'Requisição inválida' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler — never expose internal errors to client
app.use((err, req, res, next) => {
    // Handle payload too large (body-parser 413)
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload muito grande. Limite: 10KB.' });
    }
    // Handle malformed JSON
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'JSON inválido.' });
    }
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({ error: 'Erro interno do servidor' });
});

// Startup validation
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET não configurado no .env');
    process.exit(1);
}

// Iniciar servidor
async function start() {
    await connectDB();
    server.listen(PORT, () => {
        console.log('\n🏠 MoraJunto rodando em http://localhost:' + PORT);
        console.log('📦 MongoDB: ' + (connectDB.isConnected() ? '✅ Conectado' : '❌ Não disponível'));
        console.log('🤖 Busca IA (Groq): ' + (process.env.GROQ_API_KEY ? '✅ Ativa' : '❌ Desativada'));
        console.log('');
    });
}

start();
