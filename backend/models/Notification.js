const mongoose = require('mongoose');

var notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['payment_reminder', 'payment_due', 'payment_late', 'payment_received', 'roommate_paid', 'roommate_late'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: {
        paymentTransactionId: { type: mongoose.Schema.Types.ObjectId },
        rentalId: { type: mongoose.Schema.Types.ObjectId },
        month: { type: String }
    },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// Auto-delete after 60 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
