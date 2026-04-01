const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const authMiddleware = require('../middleware/auth');
const { agencyMiddleware } = require('../middleware/auth');
const connectDB = require('../config/db');

const rateLimit = require('express-rate-limit');
const { getLocationData } = require('../services/geolocation');
const { validateId } = require('../middleware/validateId');

function requireDB(req, res, next) {
    if (!connectDB.isConnected()) return res.status(503).json({ error: 'Banco de dados não disponível.' });
    next();
}

router.use(requireDB);

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Gera regex que ignora acentos (ex: "sumare" encontra "Sumaré")
function accentRegex(str) {
    var map = {
        'a': '[aáàâã]', 'e': '[eéèê]', 'i': '[iíì]', 'o': '[oóòôõ]', 'u': '[uúù]',
        'c': '[cç]', 'n': '[nñ]'
    };
    var escaped = escapeRegex(str);
    var pattern = '';
    for (var i = 0; i < escaped.length; i++) {
        var ch = escaped[i].toLowerCase();
        pattern += map[ch] || escaped[i];
    }
    return new RegExp(pattern, 'i');
}

var leadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitos contatos enviados. Tente novamente em 15 minutos.' }
});

// GET /api/properties/featured — top 6 mais visualizados
router.get('/featured', async (req, res) => {
    try {
        var properties = await Property.find({ status: 'active' })
            .sort({ views: -1 })
            .limit(6)
            .populate('agency', 'name');
        res.json(properties);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar destaques' });
    }
});

// GET /api/properties — listar com filtros e paginação
router.get('/', async (req, res) => {
    try {
        var query = { status: 'active' };
        var { type, transaction, minPrice, maxPrice, bedrooms, neighborhood, search, sort, page } = req.query;

        if (type) query.type = type.includes(',') ? { $in: type.split(',') } : type;
        if (transaction) query.transaction = transaction;
        if (bedrooms) query.bedrooms = { $gte: parseInt(bedrooms) };
        if (neighborhood) query.neighborhood = accentRegex(neighborhood);

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        if (search) {
            var searchRgx = accentRegex(search);
            query.$or = [
                { title: searchRgx },
                { description: searchRgx },
                { neighborhood: searchRgx },
                { address: searchRgx }
            ];
        }

        // Ordenação
        var sortOption = { createdAt: -1 }; // padrão: mais recentes
        if (sort === 'price_asc') sortOption = { price: 1 };
        else if (sort === 'price_desc') sortOption = { price: -1 };
        else if (sort === 'newest' || sort === 'recent') sortOption = { createdAt: -1 };

        var limit = 20;
        var safePage = Math.max(1, Math.min(parseInt(page) || 1, 1000));
        var skip = (safePage - 1) * limit;

        var total = await Property.countDocuments(query);
        var properties = await Property.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate('agency', 'name');

        res.json({
            properties,
            total,
            page: page ? parseInt(page) : 1,
            pages: Math.ceil(total / limit)
        });
    } catch (e) {
        console.error('List properties error:', e.message);
        res.status(500).json({ error: 'Erro ao listar imóveis' });
    }
});

// GET /api/properties/:id — detalhes com incremento de views
router.get('/:id', validateId('id'), async (req, res) => {
    try {
        var property = await Property.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        ).populate('agency', 'name');

        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }

        // Auto-fetch nearby POIs if not cached or stale (>7 days)
        var needsUpdate = !property.nearbyPOIs || !property.nearbyUpdatedAt ||
            (Date.now() - new Date(property.nearbyUpdatedAt).getTime() > 7 * 24 * 60 * 60 * 1000);

        if (needsUpdate && (property.address || property.neighborhood)) {
            try {
                var locationData = await getLocationData(property.address, property.neighborhood, property.city);
                if (locationData) {
                    property.latitude = locationData.latitude;
                    property.longitude = locationData.longitude;
                    property.nearbyPOIs = locationData.nearbyPOIs;
                    property.neighborhoodScore = locationData.neighborhoodScore;
                    property.nearbyUpdatedAt = new Date();
                    await property.save();
                }
            } catch (geoErr) {
                // Silently fail — don't block property view
                console.error('Geolocation fetch error:', geoErr.message);
            }
        }

        res.json(property);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar imóvel' });
    }
});

// POST /api/properties — criar imóvel (apenas imobiliária/admin)
router.post('/', authMiddleware, agencyMiddleware, async (req, res) => {
    try {
        // Whitelist de campos permitidos (previne mass assignment)
        var allowed = ['title', 'description', 'price', 'address', 'neighborhood', 'city',
            'type', 'transaction', 'bedrooms', 'bathrooms', 'area', 'furnished', 'petFriendly',
            'photos', 'features', 'availableFrom', 'maxRoommates', 'genderPreference',
            'nearUniversity', 'contactPhone', 'contactWhatsapp'];
        var data = {};
        allowed.forEach(function(field) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        });
        data.agency = req.user.userId;

        var property = await Property.create(data);

        // Background geocoding — don't block response
        if (data.address || data.neighborhood) {
            getLocationData(data.address, data.neighborhood, data.city).then(function(locationData) {
                if (locationData) {
                    Property.findByIdAndUpdate(property._id, {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        nearbyPOIs: locationData.nearbyPOIs,
                        nearbyUpdatedAt: new Date()
                    }).catch(function() {});
                }
            }).catch(function() {});
        }

        res.status(201).json(property);
    } catch (e) {
        console.error('Create property error:', e.message);
        res.status(500).json({ error: 'Erro ao criar imóvel' });
    }
});

// PUT /api/properties/:id — atualizar (dono ou admin)
router.put('/:id', validateId('id'), authMiddleware, agencyMiddleware, async (req, res) => {
    try {
        var property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }

        // Verificar se é o dono ou admin
        var User = require('../models/User');
        var user = await User.findById(req.user.userId);
        if (user.role !== 'admin' && property.agency.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Sem permissão para editar este imóvel' });
        }

        var allowed = ['title', 'type', 'transaction', 'price', 'address', 'neighborhood', 'bedrooms', 'bathrooms', 'area', 'description', 'features', 'images', 'photos', 'status'];
        var updateData = {};
        for (var key of allowed) { if (req.body[key] !== undefined) updateData[key] = req.body[key]; }
        var updated = await Property.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('agency', 'name');
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar imóvel' });
    }
});

// DELETE /api/properties/:id — remover (dono ou admin)
router.delete('/:id', validateId('id'), authMiddleware, agencyMiddleware, async (req, res) => {
    try {
        var property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }

        var User = require('../models/User');
        var user = await User.findById(req.user.userId);
        if (user.role !== 'admin' && property.agency.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Sem permissão para remover este imóvel' });
        }

        await Property.findByIdAndDelete(req.params.id);
        // Remover leads associados
        await Lead.deleteMany({ property: req.params.id });
        res.json({ message: 'Imóvel removido com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao remover imóvel' });
    }
});

// POST /api/properties/:id/lead — criar lead para este imóvel (rate limited)
router.post('/:id/lead', validateId('id'), leadLimiter, async (req, res) => {
    try {
        var property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ error: 'Imóvel não encontrado' });
        }

        var { name, email, phone, message } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios' });
        }
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Nome muito longo' });
        }
        if (message && message.length > 500) {
            return res.status(400).json({ error: 'Mensagem muito longa (máximo 500 caracteres)' });
        }

        var lead = await Lead.create({
            name: name.trim().substring(0, 100),
            email: email.toLowerCase().trim(),
            phone: (phone || '').substring(0, 20),
            message: (message || '').substring(0, 500),
            property: property._id,
            agency: property.agency
        });

        res.status(201).json({ message: 'Contato enviado com sucesso! A imobiliária entrará em contato.', lead });
    } catch (e) {
        console.error('Create lead error:', e.message);
        res.status(500).json({ error: 'Erro ao enviar contato' });
    }
});

module.exports = router;
