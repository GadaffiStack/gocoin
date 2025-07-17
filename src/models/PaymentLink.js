// src/models/PaymentLink.js
const mongoose = require('mongoose');

const paymentLinkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    name: { // User-defined name for the link
        type: String,
        required: [true, 'Payment link name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    currency: { // Expected currency for payment, e.g., 'GoToken', 'BTC', 'ETH', 'USD'
        type: String,
        required: [true, 'Currency for payment link is required'],
        trim: true,
        uppercase: true
    },
    linkCode: { // Short unique code for the link (e.g., 'war_jyT73D-gvva')
        type: String,
        unique: true,
        required: [true, 'Payment link code is required'],
        trim: true,
        minlength: [5, 'Link code must be at least 5 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Optional fields: expiryDate, maxUses, minAmount, maxAmount
}, { timestamps: true });

paymentLinkSchema.index({ linkCode: 1 }, { unique: true }); // Ensure fast lookup by linkCode

module.exports = mongoose.model('PaymentLink', paymentLinkSchema);