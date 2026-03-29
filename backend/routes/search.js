const express = require('express');
const router = express.Router();
const https = require('https');
const Property = require('../models/Property');
const connectDB = require('../config/db');

function requireDB(req, res, next) {
    if (!connectDB.isConnected()) return res.status(503).json({ error: 'Banco de dados não disponível.' });
    next();
}

router.use(requireDB);

var GROQ_KEY = '';

function getGroqKey() {
    if (!GROQ_KEY) GROQ_KEY = process.env.GROQ_API_KEY || '';
    return GROQ_KEY;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeAIQuery(query) {
    return query.trim().substring(0, 200)
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/```/g, '')
        .replace(/(ignore|forget|disregard|override|reveal|extract|dump|show)\s*(previous|all|above|system|prompt|instructions?|your)/gi, '')
        .replace(/(you\s*are|act\s*as|pretend|roleplay|new\s*instructions?)/gi, '');
}

var SYSTEM_PROMPT = `Você é um assistente de busca de imóveis. Receba uma busca em linguagem natural e extraia filtros estruturados.

Retorne APENAS um JSON válido (sem markdown, sem explicação) com os campos encontrados:
{
  "type": "apartamento|casa|comercial|terreno|kitnet|cobertura",
  "transaction": "aluguel|venda",
  "minPrice": 0,
  "maxPrice": 0,
  "bedrooms": 0,
  "neighborhood": "nome do bairro",
  "features": ["piscina", "churrasqueira", "etc"]
}

REGRAS:
- Retorne APENAS os campos mencionados ou implícitos no texto. Omita campos não mencionados.
- "apto" = apartamento, "ap" = apartamento, "kit" = kitnet, "alugar" = aluguel, "comprar" = venda
- "até X" = maxPrice. "a partir de X" = minPrice. "entre X e Y" = minPrice e maxPrice.
- "2 quartos" = bedrooms: 2. "3 dormitórios" = bedrooms: 3.
- Bairros de Ribeirão Preto: Jardim Irajá, Centro, Campos Elíseos, Ribeirânia, Alto da Boa Vista, Jardim Califórnia, Vila Seixas, Jardim Sumaré, etc.
- "perto da USP" = neighborhood: "Campus USP" ou "Ribeirânia" (bairro próximo à USP em Ribeirão Preto)
- Valores: "1500" = 1500. "mil e quinhentos" = 1500. "2k" = 2000.
- NÃO invente dados. Só extraia o que está no texto.`;

function callGroq(query) {
    var key = getGroqKey();
    if (!key) return Promise.reject(new Error('GROQ_API_KEY não configurada'));

    var body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: sanitizeAIQuery(query) }
        ],
        temperature: 0.1,
        max_tokens: 300
    });

    return new Promise(function(resolve, reject) {
        var request = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'application/json'
            }
        }, function(response) {
            var data = '';
            response.on('data', function(chunk) { data += chunk; });
            response.on('end', function() {
                if (response.statusCode >= 400) {
                    reject(new Error('Groq API error: ' + data));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Erro ao parsear resposta da IA'));
                    }
                }
            });
        });
        request.on('error', reject);
        request.end(body);
    });
}

// POST /api/search — busca por linguagem natural
router.post('/', async (req, res) => {
    try {
        var { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Digite o que você procura' });
        }

        // Chamar Groq para extrair filtros
        var parsedFilters = {};
        try {
            var result = await callGroq(query);
            var content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
            if (content) {
                var jsonStr = content.trim();
                // Remover possível markdown wrapping
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                parsedFilters = JSON.parse(jsonStr);
            }
        } catch (aiErr) {
            console.error('AI parse error:', aiErr.message);
            // Fallback: busca textual simples
            parsedFilters = {};
        }

        // Montar query MongoDB a partir dos filtros
        var dbQuery = { status: 'active' };

        if (parsedFilters.type) dbQuery.type = parsedFilters.type;
        if (parsedFilters.transaction) dbQuery.transaction = parsedFilters.transaction;
        if (parsedFilters.bedrooms) dbQuery.bedrooms = { $gte: parseInt(parsedFilters.bedrooms) };
        if (parsedFilters.neighborhood) dbQuery.neighborhood = new RegExp(escapeRegex(parsedFilters.neighborhood), 'i');

        if (parsedFilters.minPrice || parsedFilters.maxPrice) {
            dbQuery.price = {};
            if (parsedFilters.minPrice) dbQuery.price.$gte = parseFloat(parsedFilters.minPrice);
            if (parsedFilters.maxPrice) dbQuery.price.$lte = parseFloat(parsedFilters.maxPrice);
        }

        // Se a IA não extraiu nenhum filtro, fazer busca textual
        if (Object.keys(parsedFilters).length === 0) {
            var escaped = escapeRegex(query);
            dbQuery.$or = [
                { title: new RegExp(escaped, 'i') },
                { description: new RegExp(escaped, 'i') },
                { neighborhood: new RegExp(escaped, 'i') },
                { address: new RegExp(escaped, 'i') }
            ];
        }

        var properties = await Property.find(dbQuery)
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('agency', 'name');

        res.json({
            query: query,
            filters: parsedFilters,
            total: properties.length,
            properties: properties
        });
    } catch (e) {
        console.error('Search error:', e.message);
        res.status(500).json({ error: 'Erro na busca' });
    }
});

module.exports = router;
