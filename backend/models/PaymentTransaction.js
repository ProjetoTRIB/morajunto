const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    rental: { type: mongoose.Schema.Types.ObjectId, ref: 'Rental' },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantName: String,
    ownerName: String,
    month: String, // "2026-04"
    rentAmount: { type: Number }, // valor do aluguel
    feePercent: { type: Number, default: 8 },
    feeAmount: { type: Number }, // taxa MoraJunto
    totalAmount: { type: Number }, // total que inquilino paga
    ownerReceives: { type: Number }, // o que proprietário recebe
    mpPaymentId: { type: String }, // ID do pagamento no Mercado Pago (legado)
    mpStatus: { type: String, default: 'pending' },
    asaasPaymentId: { type: String }, // ID da cobrança no Asaas
    asaasStatus: { type: String }, // PENDING, RECEIVED, CONFIRMED, OVERDUE
    pixQrCode: { type: String },
    pixQrCodeBase64: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date },
    paidAt: { type: Date },
    // Commission tracking
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agentCommission: { type: Number, default: 0 },
    platformNet: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

// Prevent duplicate charges for same rental+month
paymentTransactionSchema.index({ rental: 1, month: 1, tenant: 1 }, { unique: true });

paymentTransactionSchema.index({ tenant: 1, month: 1 });
paymentTransactionSchema.index({ owner: 1, month: 1 });
paymentTransactionSchema.index({ mpPaymentId: 1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
