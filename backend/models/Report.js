const mongoose = require('mongoose');

var reportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    reason: { type: String, enum: ['scam', 'harassment', 'fake_profile', 'contact_bypass', 'other'], required: true },
    description: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
    adminNote: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
});

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reported: 1 });

module.exports = mongoose.model('Report', reportSchema);
