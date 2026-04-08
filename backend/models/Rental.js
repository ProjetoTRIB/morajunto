const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rentAmount: { type: Number, required: true },
    platformFee: { type: Number, default: 0.08 }, // 8%
    feeAmount: { type: Number },
    totalPerTenant: { type: Number },
    dueDay: { type: Number, default: 10, min: 1, max: 28 },
    status: { type: String, enum: ['active', 'pending', 'ended'], default: 'pending' },
    startDate: { type: Date },
    payments: [{
        tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        tenantName: String,
        amount: Number,
        feeIncluded: Number,
        month: String, // "2026-04"
        status: { type: String, enum: ['pending', 'paid', 'late'], default: 'pending' },
        paidAt: Date,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rental', rentalSchema);
