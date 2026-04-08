const mongoose = require('mongoose');

var propertySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
        type: String,
        enum: ['apartamento', 'casa', 'comercial', 'terreno', 'kitnet', 'cobertura', 'republica'],
        required: true
    },
    transaction: {
        type: String,
        enum: ['aluguel', 'venda'],
        required: true
    },
    price: { type: Number, required: true },
    condominio: { type: Number, default: 0 },
    iptu: { type: Number, default: 0 },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    parking: { type: Number, default: 0 },
    area: { type: Number, default: 0 },
    address: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    city: { type: String, default: 'Ribeirão Preto' },
    latitude: { type: Number },
    longitude: { type: Number },
    nearbyPOIs: { type: Object, default: null },
    nearbyUpdatedAt: { type: Date },
    photos: [{ type: String }],
    images: [{ type: String }],
    features: [{ type: String }],
    rules: { type: String, default: '' },
    neighborhoodScore: { type: Object, default: null },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['active', 'rented', 'sold', 'inactive'],
        default: 'active'
    },
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Índice de texto para busca
propertySchema.index({ title: 'text', description: 'text', neighborhood: 'text', address: 'text' });

module.exports = mongoose.model('Property', propertySchema);
