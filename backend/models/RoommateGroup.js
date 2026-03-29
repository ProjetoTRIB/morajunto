const mongoose = require('mongoose');

const roommateGroupSchema = new mongoose.Schema({
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    status: { type: String, enum: ['forming', 'searching', 'found', 'rented'], default: 'forming' },
    totalBudget: { type: Number },
    splitAmount: { type: Number },
    neighborhood: { type: String },
    chat: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        message: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoommateGroup', roommateGroupSchema);
