const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Split customizado: se vazio, divide igual. Soma das percentages deve = 100
    tenantSplits: [{
        tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        percentage: { type: Number, min: 1, max: 100 }
    }],
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
    contractAcceptances: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'tenant'] },
        acceptedAt: { type: Date },
        ip: { type: String }
    }],
    createdAt: { type: Date, default: Date.now }
});

// Validar que soma dos splits = 100 quando definido
rentalSchema.pre('save', function(next) {
    if (this.tenantSplits && this.tenantSplits.length > 0) {
        var total = this.tenantSplits.reduce(function(sum, s) { return sum + s.percentage; }, 0);
        if (Math.abs(total - 100) > 0.01) {
            return next(new Error('A soma das porcentagens dos inquilinos deve ser 100%. Atual: ' + total + '%'));
        }
    }
    next();
});

module.exports = mongoose.model('Rental', rentalSchema);
