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

const crypto = require('crypto');

// Generate build hash from frontend files to auto-bust cache on any change
var BUILD_VERSION = (function() {
    try {
        var files = ['index.html', 'style.css', 'script.js', 'roommate.js', 'republicas.js'];
        var hash = crypto.createHash('md5');
        files.forEach(function(f) {
            try { hash.update(require('fs').readFileSync(path.join(__dirname, f))); } catch(e) {}
        });
        return hash.digest('hex').substring(0, 8);
    } catch(e) { return Date.now().toString(36); }
})();
console.log('Build version:', BUILD_VERSION);

const app = express();
app.set('trust proxy', 1);
app.set('buildVersion', BUILD_VERSION);
const server = http.createServer(app);

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    var v = app.get('buildVersion');
    var swContent = require('fs').readFileSync(path.join(__dirname, 'sw.js'), 'utf-8');
    // Inject dynamic cache name and asset versions
    swContent = swContent.replace(/__BUILD_VERSION__/g, v);
    res.send(swContent);
});
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

// Images are now served directly from Cloudinary CDN (no local uploads)

// Serve index.html with dynamic build version injected
app.get('/', function(req, res) {
    var v = app.get('buildVersion');
    var html = require('fs').readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    html = html.replace(/__BUILD_VERSION__/g, v);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
});

// Arquivos estáticos — only serve frontend files, not source code
app.use(express.static(path.join(__dirname), {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
            res.setHeader('Content-Type', filePath.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));



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
app.use('/api/notifications', require('./backend/routes/notifications'));
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

// ===== SEO: Páginas por bairro (Server-Side Rendered) =====
var neighborhoodData = require('./backend/data/neighborhoods');
var SEO_BAIRROS = neighborhoodData.BAIRROS;
var BEDROOM_MULT = neighborhoodData.BEDROOM_MULTIPLIER;
var CITY_AVG = neighborhoodData.CITY_AVG_2Q;

// Cache em memória para páginas SSR (TTL 30 min)
var seoCache = new Map();
var SEO_CACHE_TTL = 1800000;

// Helper para escapar HTML
function escHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

var { accentRegex: bairroRegex } = require('./backend/utils/textSearch');

// Helper: tier label e cor
function tierInfo(tier) {
    if (tier === 'popular') return { label: 'Popular', color: '#16a34a', bg: '#dcfce7', desc: 'aluguéis acessíveis, ótimo custo-benefício' };
    if (tier === 'nobre') return { label: 'Nobre', color: '#b45309', bg: '#fef3c7', desc: 'bairro valorizado, infraestrutura premium' };
    return { label: 'Intermediário', color: '#2563eb', bg: '#dbeafe', desc: 'equilíbrio entre preço e qualidade' };
}

// Helper: formata preço BR
function fmtPrice(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

// Helper: scores estimados por tier
function tierScores(tier) {
    if (tier === 'nobre') return { transporte: 80, comercio: 90, lazer: 85, sossego: 75, seguranca: 85 };
    if (tier === 'popular') return { transporte: 75, comercio: 70, lazer: 55, sossego: 60, seguranca: 65 };
    return { transporte: 78, comercio: 80, lazer: 70, sossego: 68, seguranca: 75 };
}

// Helper: gera head HTML padrão SEO
function seoHead(opts) {
    return '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + opts.title + '</title>' +
        '<meta name="description" content="' + opts.description + '">' +
        '<meta name="robots" content="index, follow">' +
        '<link rel="canonical" href="' + opts.canonical + '">' +
        '<meta name="geo.region" content="BR-SP">' +
        '<meta name="geo.placename" content="' + opts.placename + '">' +
        '<meta property="og:type" content="website">' +
        '<meta property="og:locale" content="pt_BR">' +
        '<meta property="og:title" content="' + opts.ogTitle + '">' +
        '<meta property="og:description" content="' + opts.ogDesc + '">' +
        '<meta property="og:url" content="' + opts.canonical + '">' +
        '<meta property="og:site_name" content="MoraJunto">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:title" content="' + opts.ogTitle + '">' +
        '<meta name="twitter:description" content="' + opts.ogDesc + '">' +
        '<link rel="icon" type="image/svg+xml" href="/icon.svg">' +
        '<meta name="theme-color" content="#4338CA">' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
        '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">' +
        '<link rel="stylesheet" href="/style.css?v=' + app.get('buildVersion') + '">';
}

// Helper: navbar padrão
function seoNav() {
    return '<nav class="navbar"><div class="container nav-content">' +
        '<a href="/" class="logo"><span class="logo-text"><span class="logo-light">mora</span><strong class="logo-bold">junto</strong></span></a>' +
        '<div class="nav-links">' +
            '<a href="/">Início</a>' +
            '<a href="/bairros">Bairros</a>' +
            '<a href="/#search">Imóveis</a>' +
            '<a href="/#republicas">Repúblicas</a>' +
            '<a href="/#roommate">Dividir Apto</a>' +
        '</div>' +
    '</div></nav>';
}

// Helper: footer padrão
function seoFooter() {
    return '<footer class="footer"><div class="container"><div class="footer-bottom">' +
        '<p class="footer-copy">&copy; 2026 MoraJunto. Todos os direitos reservados.</p>' +
        '<nav class="seo-footer-links">' +
            '<a href="/">Início</a>' +
            '<a href="/bairros">Bairros</a>' +
            '<a href="/#search">Imóveis</a>' +
            '<a href="/#republicas">Repúblicas</a>' +
        '</nav>' +
    '</div></div></footer>';
}

// ===== robots.txt =====
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(
        'User-agent: *\n' +
        'Allow: /\n' +
        'Allow: /bairros\n' +
        'Allow: /bairro/\n' +
        'Disallow: /api/\n' +
        'Disallow: /uploads/\n' +
        'Disallow: /sw.js\n\n' +
        'Sitemap: ' + BASE_URL + '/sitemap.xml\n'
    );
});

// ===== sitemap.xml dinâmico =====
app.get('/sitemap.xml', (req, res) => {
    var today = new Date().toISOString().split('T')[0];
    var urls = [
        { loc: BASE_URL + '/', priority: '1.0', freq: 'daily' },
        { loc: BASE_URL + '/bairros', priority: '0.8', freq: 'weekly' }
    ];
    Object.keys(SEO_BAIRROS).forEach(function(slug) {
        urls.push({ loc: BASE_URL + '/bairro/' + slug, priority: '0.7', freq: 'weekly' });
    });
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map(function(u) {
            return '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <changefreq>' + u.freq + '</changefreq>\n    <priority>' + u.priority + '</priority>\n  </url>';
        }).join('\n') + '\n</urlset>';
    res.type('application/xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(xml);
});

// ===== GET /bairro/:slug — Página SEO rica por bairro =====
app.get('/bairro/:slug', async (req, res) => {
    var slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Cache check
    var cached = seoCache.get(slug);
    if (cached && (Date.now() - cached.time < SEO_CACHE_TTL)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(cached.html);
    }

    var bairro = SEO_BAIRROS[slug];
    if (!bairro) {
        bairro = {
            name: slug.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
            zone: 'Ribeirão Preto', tier: 'medio',
            avg2q: CITY_AVG, min: 800, max: 4000,
            unis: [], desc: 'bairro de Ribeirão Preto',
            longDesc: 'Explore imóveis disponíveis neste bairro de Ribeirão Preto e encontre a moradia ideal para dividir.',
            related: []
        };
    }

    try {
        var Property = require('./backend/models/Property');
        var rgx = bairroRegex(bairro.name);

        // Query otimizada com aggregation
        var agg = await Property.aggregate([
            { $match: { status: 'active', neighborhood: rgx } },
            { $sort: { createdAt: -1 } },
            { $facet: {
                properties: [{ $limit: 20 }],
                count: [{ $count: 'total' }],
                avgPrice: [{ $group: { _id: null, avg: { $avg: '$price' } } }],
                byType: [{ $group: { _id: '$type', avg: { $avg: '$price' }, count: { $sum: 1 } } }]
            }}
        ]);

        var result = agg[0] || {};
        var properties = result.properties || [];
        var totalCount = (result.count && result.count[0]) ? result.count[0].total : 0;
        var avgPrice = (result.avgPrice && result.avgPrice[0]) ? Math.round(result.avgPrice[0].avg) : 0;
        var byType = result.byType || [];

        var v = app.get('buildVersion');
        var bName = escHtml(bairro.name);
        var ti = tierInfo(bairro.tier);

        // Preços por quartos
        var prices = {
            '1': Math.round(bairro.avg2q * BEDROOM_MULT[1]),
            '2': bairro.avg2q,
            '3': Math.round(bairro.avg2q * BEDROOM_MULT[3]),
            '4': Math.round(bairro.avg2q * BEDROOM_MULT[4])
        };

        // Comparação com média da cidade
        var diffPercent = Math.round(((bairro.avg2q - CITY_AVG) / CITY_AVG) * 100);
        var diffText = diffPercent > 0
            ? diffPercent + '% acima da média de Ribeirão Preto'
            : Math.abs(diffPercent) + '% abaixo da média de Ribeirão Preto';

        // Scores
        var scores = tierScores(bairro.tier);
        var scoreLabels = { transporte: 'Transporte', comercio: 'Comércio', lazer: 'Lazer', sossego: 'Sossego', seguranca: 'Segurança' };

        // Meta description dinâmica
        var metaDesc = totalCount + ' imóveis para alugar em ' + bairro.name + ', Ribeirão Preto a partir de ' + fmtPrice(bairro.min) + '/mês.';
        if (bairro.unis.length > 0) metaDesc += ' Próximo a ' + bairro.unis.slice(0, 2).join(' e ') + '.';
        metaDesc += ' Encontre roommates no MoraJunto.';

        // FAQ data
        var faqs = [
            {
                q: 'Qual o preço médio de aluguel em ' + bairro.name + '?',
                a: 'O aluguel médio de um apartamento de 2 quartos em ' + bairro.name + ' é ' + fmtPrice(bairro.avg2q) + '/mês. Os valores variam de ' + fmtPrice(bairro.min) + ' a ' + fmtPrice(bairro.max) + ' dependendo do tamanho e localização.'
            },
            {
                q: 'Quanto custa dividir aluguel em ' + bairro.name + '?',
                a: 'Dividindo um apartamento de 2 quartos entre 2 pessoas em ' + bairro.name + ', cada um paga em média ' + fmtPrice(bairro.avg2q / 2) + '/mês de aluguel, mais cerca de R$ 190 de contas (água, luz, internet e gás).'
            },
            {
                q: bairro.name + ' é um bom bairro para morar em Ribeirão Preto?',
                a: bairro.name + ' é um bairro ' + ti.desc + ' na ' + bairro.zone + ' de Ribeirão Preto. ' + (bairro.unis.length > 0 ? 'Fica próximo a universidades como ' + bairro.unis.join(', ') + ', sendo ideal para estudantes.' : 'Conta com infraestrutura de comércio e serviços para o dia a dia.')
            }
        ];
        if (bairro.unis.length > 0) {
            faqs.push({
                q: 'Quais universidades ficam perto de ' + bairro.name + '?',
                a: 'As universidades próximas a ' + bairro.name + ' são: ' + bairro.unis.join(', ') + '. Muitos estudantes escolhem este bairro para dividir aluguel e morar perto do campus.'
            });
        }

        // JSON-LD: ItemList
        var jsonLdItems = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            'name': 'Imóveis para alugar em ' + bairro.name + ', Ribeirão Preto',
            'numberOfItems': totalCount,
            'itemListElement': properties.slice(0, 10).map(function(p, i) {
                return {
                    '@type': 'ListItem',
                    'position': i + 1,
                    'item': {
                        '@type': 'Residence',
                        'name': p.title || 'Imóvel em ' + bairro.name,
                        'url': BASE_URL + '/?imovel=' + p._id,
                        'address': {
                            '@type': 'PostalAddress',
                            'addressLocality': 'Ribeirão Preto',
                            'addressRegion': 'SP',
                            'addressCountry': 'BR',
                            'streetAddress': p.neighborhood || bairro.name
                        }
                    }
                };
            })
        };

        // JSON-LD: FAQPage
        var jsonLdFaq = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            'mainEntity': faqs.map(function(f) {
                return {
                    '@type': 'Question',
                    'name': f.q,
                    'acceptedAnswer': { '@type': 'Answer', 'text': f.a }
                };
            })
        };

        // Cards de imóveis
        var propCardsHtml = properties.map(function(p) {
            var img = (p.images && p.images[0]) || (p.photos && p.photos[0]) || '';
            var imgStyle = img ? "background-image:url('" + escHtml(img) + "')" : "background:#e5e7eb";
            return '<div class="property-card">' +
                '<div class="property-img" style="' + imgStyle + '">' +
                    '<span class="property-price">' + fmtPrice(p.price || 0) + '/mês</span>' +
                '</div>' +
                '<div class="property-info">' +
                    '<h3>' + escHtml(p.title) + '</h3>' +
                    '<p class="property-address">' + escHtml(p.neighborhood) + ', Ribeirão Preto</p>' +
                    '<div class="property-features">' +
                        '<span>' + (p.bedrooms || 0) + ' quartos</span>' +
                        '<span>' + (p.area || 0) + 'm²</span>' +
                    '</div>' +
                '</div>' +
                '<div class="property-card-actions">' +
                    '<a href="/?imovel=' + p._id + '" class="btn btn-accent btn-sm">Ver detalhes</a>' +
                '</div>' +
            '</div>';
        }).join('');

        var emptyHtml = properties.length === 0 ?
            '<div style="text-align:center;padding:40px 20px"><p style="color:#6b7280;font-size:1.1rem">Ainda não temos imóveis cadastrados neste bairro.</p>' +
            '<a href="/" class="btn btn-accent" style="margin-top:16px">Ver todos os imóveis</a></div>' : '';

        // Links internos — bairros relacionados
        var relatedHtml = (bairro.related || []).map(function(s) {
            var r = SEO_BAIRROS[s];
            if (!r) return '';
            var ri = tierInfo(r.tier);
            return '<a href="/bairro/' + s + '" class="seo-related-card">' +
                '<strong>' + escHtml(r.name) + '</strong>' +
                '<span class="seo-tier-badge" style="background:' + ri.bg + ';color:' + ri.color + '">' + ri.label + '</span>' +
                '<span class="seo-related-price">a partir de ' + fmtPrice(r.min) + '/mês</span>' +
            '</a>';
        }).join('');

        // Links de todos os bairros
        var allBairrosLinks = Object.keys(SEO_BAIRROS).map(function(s) {
            var active = s === slug ? ' style="font-weight:700;color:#6C3AED"' : '';
            return '<a href="/bairro/' + s + '" class="quick-tag"' + active + '>' + escHtml(SEO_BAIRROS[s].name) + '</a>';
        }).join('');

        // Seção de scores
        var scoresHtml = Object.keys(scores).map(function(key) {
            return '<div class="seo-score-item">' +
                '<span class="seo-score-label">' + scoreLabels[key] + '</span>' +
                '<div class="seo-score-bar"><div class="seo-score-fill" style="width:' + scores[key] + '%;background:' + (scores[key] >= 80 ? '#16a34a' : scores[key] >= 65 ? '#2563eb' : '#f59e0b') + '"></div></div>' +
                '<span class="seo-score-val">' + scores[key] + '</span>' +
            '</div>';
        }).join('');

        // Seção de preços por quartos
        var pricingHtml = '<div class="seo-pricing-grid">' +
            [1,2,3,4].map(function(q) {
                return '<div class="seo-pricing-card">' +
                    '<div class="seo-pricing-rooms">' + q + ' quarto' + (q > 1 ? 's' : '') + '</div>' +
                    '<div class="seo-pricing-value">' + fmtPrice(prices[q]) + '<small>/mês</small></div>' +
                    '<div class="seo-pricing-split">÷ 2 = ' + fmtPrice(prices[q] / 2) + '/pessoa</div>' +
                '</div>';
            }).join('') +
        '</div>';

        // Seção universidades
        var unisHtml = '';
        if (bairro.unis.length > 0) {
            unisHtml = '<section class="section"><div class="container">' +
                '<h2>Universidades próximas a ' + bName + '</h2>' +
                '<div class="seo-uni-list">' +
                bairro.unis.map(function(u) {
                    return '<div class="seo-uni-item"><span class="seo-uni-icon">🎓</span><div><strong>' + escHtml(u) + '</strong>' +
                        '<p>Ideal para estudantes da ' + escHtml(u) + ' que buscam moradia próxima ao campus.</p></div></div>';
                }).join('') +
                '</div>' +
            '</div></section>';
        }

        // FAQ HTML
        var faqHtml = '<div class="seo-faq">' +
            faqs.map(function(f) {
                return '<details class="seo-faq-item"><summary>' + escHtml(f.q) + '</summary><p>' + escHtml(f.a) + '</p></details>';
            }).join('') +
        '</div>';

        // Tipos de imóveis encontrados
        var typesHtml = '';
        if (byType.length > 0) {
            var typeLabels = { apartamento: 'Apartamentos', casa: 'Casas', kitnet: 'Kitnets', republica: 'Repúblicas', comercial: 'Comerciais', cobertura: 'Coberturas', terreno: 'Terrenos' };
            typesHtml = '<div class="seo-types-row">' +
                byType.map(function(t) {
                    return '<span class="seo-type-tag">' + (typeLabels[t._id] || t._id) + ' (' + t.count + ')</span>';
                }).join('') +
            '</div>';
        }

        // ===== MONTAR HTML COMPLETO =====
        var html = '<!DOCTYPE html><html lang="pt-BR"><head>' +
            seoHead({
                title: 'Aluguel em ' + bName + ', Ribeirão Preto — Imóveis para Dividir | MoraJunto',
                description: escHtml(metaDesc),
                canonical: BASE_URL + '/bairro/' + slug,
                placename: bName + ', Ribeirão Preto',
                ogTitle: 'Imóveis em ' + bName + ', Ribeirão Preto — MoraJunto',
                ogDesc: escHtml(metaDesc)
            }) +
            '<script type="application/ld+json">' + JSON.stringify(jsonLdItems) + '</script>' +
            '<script type="application/ld+json">' + JSON.stringify(jsonLdFaq) + '</script>' +
        '</head><body>' +
            seoNav() +

            // HERO
            '<section class="seo-bairro-hero"><div class="container">' +
                '<div class="seo-hero-breadcrumb"><a href="/">MoraJunto</a> &rsaquo; <a href="/bairros">Bairros</a> &rsaquo; <span>' + bName + '</span></div>' +
                '<h1>Imóveis para alugar em ' + bName + ', Ribeirão Preto</h1>' +
                '<p class="seo-hero-desc">' + escHtml(bairro.longDesc) + '</p>' +
                '<div class="seo-bairro-stats">' +
                    '<div class="seo-bairro-stat"><strong>' + totalCount + '</strong><span>imóveis</span></div>' +
                    (avgPrice > 0 ? '<div class="seo-bairro-stat"><strong>' + fmtPrice(avgPrice) + '</strong><span>preço médio</span></div>' : '') +
                    '<div class="seo-bairro-stat"><strong>' + fmtPrice(bairro.min) + '+</strong><span>a partir de</span></div>' +
                    '<div class="seo-bairro-stat"><span class="seo-tier-badge" style="background:' + ti.bg + ';color:' + ti.color + '">' + ti.label + '</span><span>' + bairro.zone + '</span></div>' +
                '</div>' +
            '</div></section>' +

            // PREÇOS
            '<section class="section"><div class="container">' +
                '<h2>Preços de aluguel em ' + bName + '</h2>' +
                '<p class="seo-section-sub">Valores médios para o bairro ' + bName + ' — <strong>' + diffText + '</strong></p>' +
                pricingHtml +
                typesHtml +
            '</div></section>' +

            // UNIVERSIDADES (condicional)
            unisHtml +

            // IMÓVEIS
            '<section class="section sec-alt"><div class="container">' +
                '<h2>' + (totalCount > 0 ? totalCount + ' imóveis disponíveis em ' + bName : 'Imóveis em ' + bName) + '</h2>' +
                '<div class="property-grid">' + propCardsHtml + '</div>' +
                emptyHtml +
            '</div></section>' +

            // COMO É MORAR
            '<section class="section"><div class="container">' +
                '<h2>Como é morar em ' + bName + '</h2>' +
                '<div class="seo-morar-grid">' +
                    '<div class="seo-morar-text">' +
                        '<p>' + escHtml(bairro.name) + ' é um bairro da <strong>' + escHtml(bairro.zone) + '</strong> de Ribeirão Preto, classificado como <strong>' + ti.label.toLowerCase() + '</strong> — ' + ti.desc + '.</p>' +
                        '<p>' + escHtml(bairro.longDesc) + '</p>' +
                        (bairro.unis.length > 0 ? '<p>Destaque para a proximidade com <strong>' + bairro.unis.join(', ') + '</strong>, tornando o bairro uma excelente opção para estudantes universitários que buscam dividir aluguel.</p>' : '') +
                    '</div>' +
                    '<div class="seo-morar-scores">' +
                        '<h3>Avaliação do bairro</h3>' +
                        scoresHtml +
                    '</div>' +
                '</div>' +
            '</div></section>' +

            // FAQ
            '<section class="section sec-alt"><div class="container">' +
                '<h2>Perguntas frequentes sobre ' + bName + '</h2>' +
                faqHtml +
            '</div></section>' +

            // BAIRROS RELACIONADOS
            (relatedHtml ? '<section class="section"><div class="container">' +
                '<h2>Bairros próximos a ' + bName + '</h2>' +
                '<div class="seo-related-grid">' + relatedHtml + '</div>' +
            '</div></section>' : '') +

            // TODOS OS BAIRROS
            '<section class="section sec-alt"><div class="container">' +
                '<h2>Todos os bairros de Ribeirão Preto</h2>' +
                '<div class="search-quick-tags" style="justify-content:center">' + allBairrosLinks + '</div>' +
            '</div></section>' +

            // CTA
            '<section class="section"><div class="container center">' +
                '<h2>Quer dividir aluguel em ' + bName + '?</h2>' +
                '<p style="color:var(--text-secondary);max-width:600px;margin:12px auto 24px">Crie seu perfil grátis e encontre roommates compatíveis. Match por IA, perfis verificados e chat direto.</p>' +
                '<a href="/" class="btn btn-accent btn-lg">Criar perfil grátis no MoraJunto</a>' +
            '</div></section>' +

            seoFooter() +
        '</body></html>';

        // Salvar no cache
        seoCache.set(slug, { html: html, time: Date.now() });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(html);
    } catch (e) {
        console.error('SEO bairro error:', e.message);
        res.status(500).send('<html><body><h1>Erro temporário</h1><p>Tente novamente em instantes.</p><a href="/">Voltar ao início</a></body></html>');
    }
});

// ===== GET /bairros — Index de todos os bairros agrupados por zona =====
app.get('/bairros', (req, res) => {
    var v = app.get('buildVersion');
    var zones = {};
    var totalBairros = Object.keys(SEO_BAIRROS).length;

    // Agrupar por zona
    Object.keys(SEO_BAIRROS).forEach(function(slug) {
        var b = SEO_BAIRROS[slug];
        var zone = b.zone || 'Outros';
        if (!zones[zone]) zones[zone] = [];
        zones[zone].push({ slug: slug, data: b });
    });

    // Ordem das zonas
    var zoneOrder = ['Centro e Região Central', 'Zona Sul', 'Zona Oeste', 'Zona Norte', 'Zona Leste', 'Outros'];

    var zonesHtml = zoneOrder.map(function(zoneName) {
        var items = zones[zoneName];
        if (!items || items.length === 0) return '';

        var cardsHtml = items.map(function(item) {
            var b = item.data;
            var ti = tierInfo(b.tier);
            return '<a href="/bairro/' + item.slug + '" class="seo-bairro-index-card">' +
                '<div class="seo-bairro-index-header">' +
                    '<strong>' + escHtml(b.name) + '</strong>' +
                    '<span class="seo-tier-badge" style="background:' + ti.bg + ';color:' + ti.color + '">' + ti.label + '</span>' +
                '</div>' +
                '<span class="seo-bairro-index-desc">' + escHtml(b.desc) + '</span>' +
                '<div class="seo-bairro-index-footer">' +
                    '<span>A partir de ' + fmtPrice(b.min) + '/mês</span>' +
                    '<span>Média: ' + fmtPrice(b.avg2q) + '</span>' +
                '</div>' +
            '</a>';
        }).join('');

        return '<div class="seo-zone-group">' +
            '<h2>' + escHtml(zoneName) + '</h2>' +
            '<div class="seo-zone-grid">' + cardsHtml + '</div>' +
        '</div>';
    }).join('');

    // JSON-LD ItemList
    var jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Bairros de Ribeirão Preto para alugar imóveis',
        'numberOfItems': totalBairros,
        'itemListElement': Object.keys(SEO_BAIRROS).map(function(slug, i) {
            return {
                '@type': 'ListItem',
                'position': i + 1,
                'item': {
                    '@type': 'Place',
                    'name': SEO_BAIRROS[slug].name + ', Ribeirão Preto',
                    'url': BASE_URL + '/bairro/' + slug
                }
            };
        })
    };

    var html = '<!DOCTYPE html><html lang="pt-BR"><head>' +
        seoHead({
            title: 'Bairros de Ribeirão Preto — Imóveis para Alugar e Dividir | MoraJunto',
            description: 'Explore imóveis para alugar em ' + totalBairros + '+ bairros de Ribeirão Preto. Compare preços, veja avaliações e encontre o bairro ideal para dividir aluguel.',
            canonical: BASE_URL + '/bairros',
            placename: 'Ribeirão Preto, SP',
            ogTitle: 'Bairros de Ribeirão Preto — MoraJunto',
            ogDesc: 'Explore imóveis em ' + totalBairros + '+ bairros de Ribeirão Preto. Compare preços e encontre o bairro ideal.'
        }) +
        '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' +
    '</head><body>' +
        seoNav() +
        '<section class="seo-bairro-hero"><div class="container">' +
            '<div class="seo-hero-breadcrumb"><a href="/">MoraJunto</a> &rsaquo; <span>Bairros</span></div>' +
            '<h1>Bairros de Ribeirão Preto</h1>' +
            '<p>Explore imóveis para alugar e dividir em ' + totalBairros + '+ bairros da cidade. Compare preços, veja avaliações e encontre o bairro ideal para morar.</p>' +
        '</div></section>' +
        '<section class="section"><div class="container">' +
            zonesHtml +
        '</div></section>' +
        '<section class="section sec-alt"><div class="container center">' +
            '<h2>Encontre seu bairro ideal</h2>' +
            '<p style="color:var(--text-secondary);max-width:600px;margin:12px auto 24px">Crie seu perfil grátis e receba sugestões de imóveis e roommates no bairro que você escolher.</p>' +
            '<a href="/" class="btn btn-accent btn-lg">Começar agora — é grátis</a>' +
        '</div></section>' +
        seoFooter() +
    '</body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
});

// SPA fallback — reject path traversal attempts
app.get('/{*splat}', (req, res) => {
    if (req.path.includes('..') || req.path.includes('%2e') || req.path.includes('%2E')) {
        return res.status(400).json({ error: 'Requisição inválida' });
    }
    var v = app.get('buildVersion');
    var html = require('fs').readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    html = html.replace(/__BUILD_VERSION__/g, v);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
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

// ===== CRON JOBS =====
var cron = require('node-cron');
var { runDailyReminders } = require('./backend/services/reminderService');
var { autoGenerateMonthlyCharges, autoTransferToOwners } = require('./backend/services/paymentCron');

var cronOpts = { timezone: 'America/Sao_Paulo' };

// Lembretes diários (9h Brasília)
cron.schedule('0 9 * * *', async function() {
    try {
        await runDailyReminders(io, onlineUsers);
    } catch (e) {
        console.error('Reminder cron error:', e.message);
    }
}, cronOpts);

// Auto-gerar cobranças mensais (8h Brasília)
cron.schedule('0 8 * * *', async function() {
    try {
        await autoGenerateMonthlyCharges();
    } catch (e) {
        console.error('Auto-generate cron error:', e.message);
    }
}, cronOpts);

// Auto-repasse para proprietários (14h Brasília)
cron.schedule('0 14 * * *', async function() {
    try {
        await autoTransferToOwners();
    } catch (e) {
        console.error('Auto-transfer cron error:', e.message);
    }
}, cronOpts);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});

start();
