// src/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    type: { // e.g., 'received', 'withdrawal', 'swap', 'send', 'task_reward', 'referral_bonus'
        type: String,
        required: [true, 'Transaction type is required'],
        enum: {
            values: [
                'received', 'withdrawal', 'swap', 'send', 'task_reward',
                'referral_bonus', 'payment_link_receive', 'mobile_money_send',
                'bank_transfer_send', 'crypto_send', 'bank_withdraw', 'mobile_money_withdraw'
            ],
            message: '"{VALUE}" is not a valid transaction type.'
        }
    },
    amountGoToken: { // Amount in GoTokens (positive for incoming, negative for outgoing)
        type: Number,
        required: [true, 'GoToken amount is required']
    },
    amountFiat: { // Equivalent fiat value at the time of transaction
        type: Number
    },
    fiatCurrency: { // e.g., 'USD', 'NGN'
        type: String,
        trim: true,
        uppercase: true
    },
    status: { // e.g., 'pending', 'completed', 'failed', 'cancelled'
        type: String,
        enum: {
            values: ['pending', 'completed', 'failed', 'cancelled'],
            message: '"{VALUE}" is not a valid transaction status.'
        },
        default: 'pending'
    },
    transactionId: { // Unique ID for external transactions (e.g., blockchain tx hash, bank reference)
        type: String,
        unique: true, // Only if all transaction IDs are unique globally
        sparse: true, // Allows nulls while enforcing uniqueness for non-null values
        trim: true
    },
    feeGoToken: { // Fee deducted in GoTokens for this transaction
        type: Number,
        default: 0
    },
    // Details specific to transaction types (Mixed for flexibility)
    details: {
        // For 'swap'
        fromCurrency: String,
        toCurrency: String,
        fromAmount: Number,
        toAmount: Number,
        exchangeRate: Number,

        // For 'send' / 'withdraw' (crypto)
        toWalletAddress: String,
        cryptoType: String, // e.g., 'BTC', 'ETH', 'GoToken'
        networkFee: Number,

        // For 'send' / 'withdraw' (bank/mobile money)
        accountNumber: String,
        bankName: String,
        mobileNumber: String,
        mobileNetwork: String,
        beneficiaryName: String, // For send, might be explicitly provided
        paymentDescription: String,

        // For 'received' / 'payment_link_receive'
        fromAddress: String, // Crypto address or payment link code
        paymentLinkCode: String,

        // For 'task_reward' / 'referral_bonus'
        relatedEntityId: mongoose.Schema.Types.ObjectId, // taskId or referrerId
        relatedEntityType: {
            type: String,
            enum: ['Task', 'User'], // Define possible related entities
            message: '"{VALUE}" is not a valid related entity type.'
        },
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for faster queries on user transactions and by type
transactionSchema.index({ userId: 1, timestamp: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ transactionId: 1 }); // If querying by external transaction ID

module.exports = mongoose.model('Transaction', transactionSchema);