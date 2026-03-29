const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    propertyTitle: { type: String, default: '' },
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: { type: String },
        text: { type: String, required: true },
        blocked: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    }],
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
