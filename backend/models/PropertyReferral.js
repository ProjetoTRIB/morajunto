const mongoose = require('mongoose');

const propertyReferralSchema = new mongoose.Schema({
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true, trim: true },
    ownerEmail: { type: String, default: '', trim: true },
    address: { type: String, required: true, trim: true },
    neighborhood: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    photos: [{ type: String }],
    status: {
        type: String,
        enum: ['pending', 'validated', 'listed', 'rented', 'paid', 'rejected'],
        default: 'pending'
    },
    rewardAmount: { type: Number, default: 0 },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    adminNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    paidAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

propertyReferralSchema.index({ referrer: 1, createdAt: -1 });
propertyReferralSchema.index({ status: 1 });

module.exports = mongoose.model('PropertyReferral', propertyReferralSchema);
