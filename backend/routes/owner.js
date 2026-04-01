const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const Rental = require('../models/Rental');
const OwnerLead = require('../models/OwnerLead');
const authMiddleware = require('../middleware/auth');
const { getLocationData } = require('../services/geolocation');
const { recalcAgentTier, creditBonus } = require('../services/commissionService');
const rateLimit = require('express-rate-limit');
const { validateId } = require('../middleware/validateId');

// Rate limiter para leads de proprietários (5 por IP a cada 15min)
var ownerLeadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas solicitações. Tente novamente em 15 minutos.' }
});

// POST /api/owner/lead — cadastro express de proprietário (PÚBLICO, sem auth)
router.post('/lead', ownerLeadLimiter, async (req, res) => {
    try {
        var { name, email, phone, neighborhood, propertyType, price } = req.body;
        if (!name || !email || !phone || !neighborhood) {
            return res.status(400).json({ error: 'Nome, email, WhatsApp e bairro são obrigatórios' });
        }
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        var lead = await OwnerLead.create({
            name: name.trim().substring(0, 100),
            email: email.toLowerCase().trim(),
            phone: phone.substring(0, 20),
            neighborhood: neighborhood.trim().substring(0, 100),
            propertyType: (propertyType || 'apartamento').substring(0, 50),
            price: Math.max(0, Math.min(parseFloat(price) || 0, 100000))
        });

        res.status(201).json({ message: 'Recebemos seu interesse! Entraremos em contato em até 24 horas.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar. Tente novamente.' });
    }
});

// Todas as rotas abaixo requerem autenticação + role owner/admin
router.use(authMiddleware);
router.use(function(req, res, next) {
    // Stats/properties/rentals require owner or admin role
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas proprietários podem acessar esta área' });
    }
    next();
});

// GET /api/owner/pix — retorna chave PIX do proprietário
router.get('/pix', async (req, res) => {
    try {
        var user = await User.findById(req.user.userId).select('pixKey pixKeyType');
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ pixKey: user.pixKey || '', pixKeyType: user.pixKeyType || '' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar chave PIX' });
    }
});

// POST /api/owner/pix — salva chave PIX do proprietário
router.post('/pix', async (req, res) => {
    try {
        var { pixKey, pixKeyType } = req.body;
        if (!pixKey || !pixKeyType) {
            return res.status(400).json({ error: 'Chave PIX e tipo são obrigatórios' });
        }
        pixKey = pixKey.trim().substring(0, 100);
        var validTypes = ['cpf', 'email', 'telefone', 'aleatoria'];
        if (!validTypes.includes(pixKeyType)) {
            return res.status(400).json({ error: 'Tipo de chave inválido' });
        }
        // Validação por tipo
        if (pixKeyType === 'cpf' && !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(pixKey)) {
            return res.status(400).json({ error: 'CPF inválido. Use o formato 000.000.000-00' });
        }
        if (pixKeyType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        if (pixKeyType === 'telefone' && !/^\+?55?\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(pixKey.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Telefone inválido. Use (XX) XXXXX-XXXX' });
        }

        var user = await User.findByIdAndUpdate(req.user.userId, { pixKey, pixKeyType }, { new: true });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Chave PIX salva com sucesso', pixKey: user.pixKey, pixKeyType: user.pixKeyType });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar chave PIX' });
    }
});

// GET /api/owner/stats
router.get('/stats', async (req, res) => {
    try {
        var properties = await Property.countDocuments({ agency: req.user.userId });
        var activeRentals = await Rental.countDocuments({ owner: req.user.userId, status: 'active' });
        var pendingPayments = await Rental.aggregate([
            { $match: { owner: require('mongoose').Types.ObjectId.createFromHexString(req.user.userId) } },
            { $unwind: '$payments' },
            { $match: { 'payments.status': 'pending' } },
            { $count: 'total' }
        ]);
        var totalEarnings = await Rental.aggregate([
            { $match: { owner: require('mongoose').Types.ObjectId.createFromHexString(req.user.userId) } },
            { $unwind: '$payments' },
            { $match: { 'payments.status': 'paid' } },
            { $group: { _id: null, total: { $sum: '$payments.amount' } } }
        ]);
        res.json({
            properties,
            activeRentals,
            pendingPayments: pendingPayments[0] ? pendingPayments[0].total : 0,
            totalEarnings: totalEarnings[0] ? totalEarnings[0].total : 0
        });
    } catch (e) {
        res.json({ properties: 0, activeRentals: 0, pendingPayments: 0, totalEarnings: 0 });
    }
});

// GET /api/owner/properties — imóveis do proprietário
router.get('/properties', async (req, res) => {
    try {
        var properties = await Property.find({ agency: req.user.userId }).sort({ createdAt: -1 });
        res.json({ properties });
    } catch (e) {
        res.json({ properties: [] });
    }
});

// POST /api/owner/properties — cadastrar imóvel (simplificado)
router.post('/properties', async (req, res) => {
    try {
        var { title, type, price, address, neighborhood, bedrooms, bathrooms, area, description, features, images } = req.body;

        if (!title || !price || !address || !neighborhood) {
            return res.status(400).json({ error: 'Título, preço, endereço e bairro são obrigatórios' });
        }

        var parsedPrice = parseFloat(price);
        var parsedArea = parseFloat(area) || 0;
        var parsedBedrooms = parseInt(bedrooms) || 0;
        var parsedBathrooms = parseInt(bathrooms) || 0;

        if (parsedPrice <= 0) return res.status(400).json({ error: 'Preço deve ser maior que zero' });
        if (parsedArea < 0) return res.status(400).json({ error: 'Área inválida' });
        if (parsedBedrooms < 0) return res.status(400).json({ error: 'Número de quartos inválido' });
        if (parsedBathrooms < 0) return res.status(400).json({ error: 'Número de banheiros inválido' });

        // Validate string lengths
        if (title.length > 200) return res.status(400).json({ error: 'Título muito longo (máx 200 caracteres)' });
        if (address.length > 300) return res.status(400).json({ error: 'Endereço muito longo (máx 300 caracteres)' });
        if (neighborhood.length > 100) return res.status(400).json({ error: 'Bairro muito longo (máx 100 caracteres)' });
        if (description && description.length > 2000) return res.status(400).json({ error: 'Descrição muito longa (máx 2000 caracteres)' });
        if (parsedPrice > 100000) return res.status(400).json({ error: 'Preço inválido' });
        if (parsedBedrooms > 50) return res.status(400).json({ error: 'Número de quartos inválido' });
        if (parsedBathrooms > 50) return res.status(400).json({ error: 'Número de banheiros inválido' });
        if (parsedArea > 10000) return res.status(400).json({ error: 'Área inválida' });

        // Validate arrays
        var safeFeatures = Array.isArray(features) ? features.filter(function(f) { return typeof f === 'string'; }).slice(0, 20).map(function(f) { return f.substring(0, 100); }) : [];
        var safeImages = Array.isArray(images) ? images.filter(function(f) { return typeof f === 'string'; }).slice(0, 20).map(function(f) { return f.substring(0, 500); }) : [];

        // Validate type enum
        var validTypes = ['apartamento', 'casa', 'kitnet', 'studio', 'cobertura', 'comercial', 'terreno', 'outro'];
        var safeType = validTypes.includes(type) ? type : 'apartamento';

        var property = await Property.create({
            title: title.substring(0, 200),
            type: safeType,
            transaction: 'aluguel',
            price: parsedPrice,
            address: address.substring(0, 300),
            neighborhood: neighborhood.substring(0, 100),
            bedrooms: parsedBedrooms,
            bathrooms: parsedBathrooms,
            area: parsedArea,
            description: (description || '').substring(0, 2000),
            features: safeFeatures,
            images: safeImages,
            photos: safeImages,
            agency: req.user.userId,
            status: 'active'
        });

        // Agent rewards: recalc tier + first listing bonus
        try {
            var agentUser = await User.findById(req.user.userId);
            if (agentUser && agentUser.role === 'agency') {
                await recalcAgentTier(req.user.userId);
                if (!agentUser.agentProfile || !agentUser.agentProfile.firstListingBonusPaid) {
                    await creditBonus(req.user.userId, 'bonus_first_listing', 50, 'Bonus primeiro imovel cadastrado', property._id);
                    await User.findByIdAndUpdate(req.user.userId, { 'agentProfile.firstListingBonusPaid': true });
                }
                // Referral bonus: if this agent was referred and this is their first listing
                if (agentUser.agentProfile && agentUser.agentProfile.referredBy) {
                    var listingCount = await Property.countDocuments({ agency: req.user.userId });
                    if (listingCount === 1) {
                        await creditBonus(agentUser.agentProfile.referredBy, 'bonus_referral', 100, 'Indicacao: ' + agentUser.name + ' cadastrou 1o imovel');
                    }
                }
            }
        } catch (e) { console.error('Agent rewards error:', e.message); }

        // Background geocoding
        if (address || neighborhood) {
            getLocationData(address, neighborhood, 'Ribeirão Preto').then(function(loc) {
                if (loc) {
                    Property.findByIdAndUpdate(property._id, {
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        nearbyPOIs: loc.nearbyPOIs,
                        nearbyUpdatedAt: new Date()
                    }).catch(function() {});
                }
            }).catch(function() {});
        }

        res.status(201).json({ property });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao cadastrar imóvel' });
    }
});

// PUT /api/owner/properties/:id — editar imóvel
router.put('/properties/:id', validateId('id'), async (req, res) => {
    try {
        var property = await Property.findOne({ _id: req.params.id, agency: req.user.userId });
        if (!property) return res.status(404).json({ error: 'Imóvel não encontrado' });

        var allowed = ['title', 'type', 'price', 'address', 'neighborhood', 'bedrooms', 'bathrooms', 'area', 'description', 'features', 'images', 'rules'];
        for (var key of allowed) {
            if (req.body[key] !== undefined) property[key] = req.body[key];
        }
        if (req.body.price) property.price = parseFloat(req.body.price);
        if (req.body.bedrooms) property.bedrooms = parseInt(req.body.bedrooms);
        if (req.body.bathrooms) property.bathrooms = parseInt(req.body.bathrooms);
        if (req.body.area) property.area = parseFloat(req.body.area);

        await property.save();
        res.json({ property });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao editar imóvel' });
    }
});

// DELETE /api/owner/properties/:id
router.delete('/properties/:id', validateId('id'), async (req, res) => {
    try {
        var property = await Property.findOne({ _id: req.params.id, agency: req.user.userId });
        if (!property) return res.status(404).json({ error: 'Imóvel não encontrado' });
        await property.deleteOne();
        // Recalc agent tier after property removal
        try { await recalcAgentTier(req.user.userId); } catch {}
        res.json({ message: 'Imóvel removido' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao remover imóvel' });
    }
});

// POST /api/owner/rentals — criar aluguel (vincular inquilinos a um imóvel)
router.post('/rentals', async (req, res) => {
    try {
        var { propertyId, tenantEmails } = req.body;

        if (!propertyId || typeof propertyId !== 'string' || !/^[a-f\d]{24}$/i.test(propertyId)) {
            return res.status(400).json({ error: 'ID do imóvel inválido' });
        }
        if (!Array.isArray(tenantEmails) || tenantEmails.length === 0 || tenantEmails.length > 20) {
            return res.status(400).json({ error: 'Informe de 1 a 20 emails de inquilinos' });
        }

        var property = await Property.findOne({ _id: propertyId, agency: req.user.userId });
        if (!property) return res.status(404).json({ error: 'Imóvel não encontrado' });

        var tenants = [];
        for (var email of tenantEmails) {
            var user = await User.findOne({ email: email.toLowerCase().trim() });
            if (user) tenants.push(user._id);
        }

        if (tenants.length === 0) {
            return res.status(400).json({ error: 'Nenhum inquilino válido encontrado' });
        }

        var feeRate = 0.08;
        var rentPerTenant = Math.round(property.price / tenants.length);
        var feePerTenant = Math.round(rentPerTenant * feeRate);
        var perTenant = rentPerTenant + feePerTenant;
        var feeAmount = feePerTenant * tenants.length;

        var rental = await Rental.create({
            property: property._id,
            owner: req.user.userId,
            tenants: tenants,
            rentAmount: property.price,
            platformFee: feeRate,
            feeAmount: feeAmount,
            totalPerTenant: perTenant,
            status: 'active',
            startDate: new Date()
        });

        // Update property status
        property.status = 'rented';
        await property.save();

        // Agent rewards: recalc tier + fast rental bonus
        try {
            if (property.agency) {
                var listingAgent = await User.findById(property.agency);
                if (listingAgent && listingAgent.role === 'agency') {
                    await recalcAgentTier(property.agency);
                    // Fast rental bonus: rented within 14 days of listing
                    var daysSinceListing = (Date.now() - new Date(property.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceListing <= 14) {
                        await creditBonus(property.agency, 'bonus_fast_rental', 30, 'Aluguel rapido em ' + Math.round(daysSinceListing) + ' dias', property._id);
                    }
                }
            }
        } catch (e) { console.error('Agent rewards rental error:', e.message); }

        res.status(201).json({
            rental,
            summary: {
                aluguel: property.price,
                taxa: feeAmount,
                totalComTaxa: property.price + feeAmount,
                porPessoa: perTenant,
                inquilinos: tenants.length
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar aluguel' });
    }
});

// GET /api/owner/rentals — aluguéis do proprietário
router.get('/rentals', async (req, res) => {
    try {
        var rentals = await Rental.find({ owner: req.user.userId })
            .populate('property', 'title address neighborhood price')
            .populate('tenants', 'name profilePhoto identityVerification socialVerified')
            .sort({ createdAt: -1 });
        res.json({ rentals });
    } catch (e) {
        res.json({ rentals: [] });
    }
});

// GET /api/owner/rentals/:id — detalhe do aluguel
router.get('/rentals/:id', validateId('id'), async (req, res) => {
    try {
        var rental = await Rental.findOne({ _id: req.params.id, owner: req.user.userId })
            .populate('property', 'title address neighborhood price images')
            .populate('tenants', 'name profilePhoto identityVerification socialVerified');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });
        res.json({ rental });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar aluguel' });
    }
});

// POST /api/owner/rentals/:id/generate-payments — gerar cobranças do mês
router.post('/rentals/:id/generate-payments', validateId('id'), async (req, res) => {
    try {
        var rental = await Rental.findOne({ _id: req.params.id, owner: req.user.userId }).populate('tenants', 'name');
        if (!rental) return res.status(404).json({ error: 'Aluguel não encontrado' });

        var month = req.body.month || new Date().toISOString().substring(0, 7); // "2026-04"

        // Check if already generated
        var exists = rental.payments.find(p => p.month === month);
        if (exists) return res.status(400).json({ error: 'Cobranças do mês ' + month + ' já foram geradas' });

        var perTenant = rental.totalPerTenant;
        var feePerTenant = Math.round(rental.feeAmount / rental.tenants.length);

        for (var tenant of rental.tenants) {
            rental.payments.push({
                tenant: tenant._id,
                tenantName: tenant.name,
                amount: perTenant,
                feeIncluded: feePerTenant,
                month: month,
                status: 'pending'
            });
        }

        await rental.save();
        res.json({ message: 'Cobranças geradas para ' + month, payments: rental.payments.filter(p => p.month === month) });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar cobranças' });
    }
});

module.exports = router;
