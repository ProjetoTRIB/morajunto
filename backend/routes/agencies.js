const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const connectDB = require('../config/db');
const { validateId } = require('../middleware/validateId');

function requireDB(req, res, next) {
    if (!connectDB.isConnected()) return res.status(503).json({ error: 'Banco de dados não disponível.' });
    next();
}

router.use(requireDB);

// GET /api/agencies — listar todas as imobiliárias (público)
router.get('/', async (req, res) => {
    try {
        var agencies = await User.find({ role: 'agency' })
            .select('name createdAt')
            .sort({ name: 1 });

        // Contar imóveis ativos de cada imobiliária
        var result = [];
        for (var i = 0; i < agencies.length; i++) {
            var agency = agencies[i].toObject();
            agency.propertyCount = await Property.countDocuments({ agency: agency._id, status: 'active' });
            result.push(agency);
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar imobiliárias' });
    }
});

// GET /api/agencies/:id/properties — listar imóveis de uma imobiliária
router.get('/:id/properties', validateId('id'), async (req, res) => {
    try {
        var agency = await User.findById(req.params.id).select('name role');
        if (!agency || agency.role === 'user') {
            return res.status(404).json({ error: 'Imobiliária não encontrada' });
        }

        var properties = await Property.find({ agency: req.params.id, status: 'active' })
            .sort({ createdAt: -1 })
            .populate('agency', 'name');

        res.json({ agency, properties });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar imóveis da imobiliária' });
    }
});

module.exports = router;
