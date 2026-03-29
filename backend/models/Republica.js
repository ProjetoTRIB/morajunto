const mongoose = require('mongoose');

const republicaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxMembers: { type: Number, default: 4 },
    price: { type: Number, default: 0 },
    splitPrice: { type: Number, default: 0 },
    address: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    city: { type: String, default: 'Ribeirão Preto' },
    latitude: { type: Number },
    longitude: { type: Number },
    photos: [String],
    features: [String],
    rules: [String],
    genderPolicy: { type: String, enum: ['feminina', 'masculina', 'mista'], default: 'mista' },
    university: { type: String, default: '' },
    availableSpots: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'full', 'inactive'], default: 'active' },
    applicants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

republicaSchema.index({ neighborhood: 'text', name: 'text', description: 'text' });

module.exports = mongoose.model('Republica', republicaSchema);
