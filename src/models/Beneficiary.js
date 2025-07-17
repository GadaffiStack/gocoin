// src/models/Beneficiary.js
const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    name: {
        type: String,
        required: [true, 'Beneficiary name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    type: { // 'bank', 'mobile_money', 'crypto'
        type: String,
        required: [true, 'Beneficiary type is required'],
        enum: {
            values: ['bank', 'mobile_money', 'crypto'],
            message: '"{VALUE}" is not a valid beneficiary type.'
        }
    },
    details: {
        // For bank
        accountNumber: {
            type: String,
            trim: true,
            required: function() { return this.type === 'bank'; }
        },
        bankName: {
            type: String,
            trim: true,
            required: function() { return this.type === 'bank'; }
        },

        // For mobile money
        mobileNumber: {
            type: String,
            trim: true,
            required: function() { return this.type === 'mobile_money'; }
        },
        network: { // e.g., MTN, Glo, Airtel (for mobile money)
            type: String,
            trim: true,
            required: function() { return this.type === 'mobile_money'; }
        },

        // For crypto
        walletAddress: {
            type: String,
            trim: true,
            required: function() { return this.type === 'crypto'; }
        },
        cryptoType: { // e.g., 'BTC', 'ETH', 'USDT'
            type: String,
            trim: true,
            uppercase: true,
            required: function() { return this.type === 'crypto'; }
        },
    }
}, { timestamps: true });

// Ensure a user doesn't have duplicate beneficiaries with the same name and type
beneficiarySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Beneficiary', beneficiarySchema);