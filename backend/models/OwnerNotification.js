const mongoose = require('mongoose');

const ownerNotificationSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    type: {
        type: String,
        enum: ['view_milestone', 'new_lead', 'new_interest', 'property_search_match'],
        required: true
    },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Auto-delete notifications older than 30 days
ownerNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('OwnerNotification', ownerNotificationSchema);
