const mongoose = require('mongoose');

const agentCommissionSchema = new mongoose.Schema({
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['rental_commission', 'bonus_first_listing', 'bonus_fast_rental', 'bonus_referral', 'payout'],
        required: true
    },
    paymentTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentTransaction' },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    rental: { type: mongoose.Schema.Types.ObjectId, ref: 'Rental' },
    amount: { type: Number, required: true }, // positivo = ganho, negativo = saque
    tierAtTime: { type: String, default: 'iniciante' },
    commissionRate: { type: Number },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'available', 'paid_out'], default: 'pending' },
    paidOutAt: { type: Date },
    paidOutRef: { type: String },
    month: { type: String },
    createdAt: { type: Date, default: Date.now }
});

agentCommissionSchema.index({ agent: 1, createdAt: -1 });
agentCommissionSchema.index({ agent: 1, status: 1 });
agentCommissionSchema.index({ paymentTransaction: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('AgentCommission', agentCommissionSchema);
