const mongoose = require('mongoose');

var leadSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    message: { type: String, default: '' },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['new', 'contacted', 'visited', 'closed'],
        default: 'new'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', leadSchema);
