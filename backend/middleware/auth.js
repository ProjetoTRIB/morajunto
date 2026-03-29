const jwt = require('jsonwebtoken');

async function authMiddleware(req, res, next) {
    var header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token necessário' });
    }
    try {
        var token = header.split(' ')[1];
        var decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        // Check token has required fields
        if (!decoded.userId) {
            return res.status(401).json({ error: 'Token malformado' });
        }

        // Verify user still exists and is not locked (BLOCKING check)
        var User = require('../models/User');
        var user = await User.findById(decoded.userId).select('_id role lockUntil').lean();

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(423).json({ error: 'Conta bloqueada temporariamente' });
        }

        req.user = { userId: decoded.userId, email: decoded.email, role: user.role };
        next();
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
}

async function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

async function agencyMiddleware(req, res, next) {
    if (req.user.role !== 'agency' && req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
}

module.exports = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
module.exports.agencyMiddleware = agencyMiddleware;
