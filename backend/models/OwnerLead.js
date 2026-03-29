const mongoose = require('mongoose');

const ownerLeadSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    neighborhood: { type: String, required: true, maxlength: 100 },
    propertyType: { type: String, default: 'apartamento' },
    price: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'contacted', 'converted', 'rejected'], default: 'pending' },
    notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('OwnerLead', ownerLeadSchema);
