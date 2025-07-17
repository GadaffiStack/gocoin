// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing and comparison

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email address is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false // Do not return password by default in queries
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    otp: { // For email confirmation
        type: String
    },
    otpExpires: {
        type: Date
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        select: false
    },
    interests: [{ // From "Select Interest" screen
        type: String,
        enum: {
            values: [
                "Books & Literature", "Education & Learning", "Sports & Fitness",
                "Online Gaming & Esports", "Real Estate", "Health & Wellness",
                "Crypto & Web3", "Technology & Gadgets", "Social Media & Influencing",
                "Photography", "Fashion & Style", "Finance & Investments",
                "Music & Concerts", "Travel & Adventure", "Movies & TV Shows",
                "Beauty & Skincare"
            ],
            message: '"{VALUE}" is not a valid interest type.'
        }
    }],
    country: { // From "Set Location" screen
        type: String,
        trim: true
    },
    stateRegion: { // From "Set Location" screen
        type: String,
        trim: true
    },
    connectedWallets: [{ // From "Connect Crypto Wallet" screen & "Manage Wallet"
        walletType: { // e.g., 'Coinbase', 'Metamask', 'Phantom', 'Trust Wallet', 'Solflare', 'Rainbow'
            type: String,
            required: [true, 'Wallet type is required']
        },
        address: { // The connected wallet address
            type: String,
            required: [true, 'Wallet address is required']
        },
        // Mongoose automatically adds an _id to subdocuments, which we'll use for removal
    }],
    goTokenBalance: { // User's main balance in GoTokens
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    fiatEquivalentBalance: { // Cached fiat equivalent for display, e.g., USD
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    referralCode: { // Unique code generated for the user
        type: String,
        unique: true,
        sparse: true, // Allows nulls while enforcing uniqueness for non-null values
        trim: true,
        uppercase: true,
        minlength: [8, 'Referral code must be at least 8 characters']
    },
    referredBy: { // User ID of the referrer
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referralCount: {
        type: Number,
        default: 0
    },
    bonusEarned: {
        type: Number,
        default: 0
    },
    status: { // For general user status or for leaderboard active/inactive display
        type: String,
        enum: {
            values: ['active', 'inactive'],
            message: 'Status can only be "active" or "inactive".'
        },
        default: 'active'
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    avatarUrl: { // For 'Edit profile image'
        type: String,
        default: 'https://res.cloudinary.com/your-cloud-name/image/upload/v1709280000/default-avatar.png' // Provide a sensible default URL
    },
    notificationPreferences: { // For Notification settings
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: false }, // Placeholder for SMS
        newTaskAlerts: { type: Boolean, default: true },
        taskReminders: { type: Boolean, default: true },
        earningsAlerts: { type: Boolean, default: true }
    },
    privacySettings: { // For Privacy settings
        activityVisibility: { type: Boolean, default: true }, // Enable others to see activities on leaderboard
        dataSharing: { type: Boolean, default: false } // Grant GoToken permission to share data
    },
    bankReceiveDetails: { // For 'Receive payments' via bank account (simplified for one account)
        bankName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        accountName: { type: String, trim: true }
    },
    passwordChangedAt: Date // To handle JWT invalidation if password changes
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt fields

// --- Mongoose Hooks and Methods ---

// Pre-save hook to hash password if it's modified
userSchema.pre('save', async function(next) {
    // Only run this function if password was actually modified
    if (!this.isModified('password')) return next();

    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Pre-save hook to update passwordChangedAt property
userSchema.pre('save', function(next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1s to ensure token is issued after password change
    next();
});

// Pre-save hook to update fiatEquivalentBalance based on goTokenBalance
userSchema.pre('save', async function(next) {
    // Only run if goTokenBalance was actually modified
    if (this.isModified('goTokenBalance')) {
        const config = require('../config/config'); // Load config here to avoid circular dependency
        const cryptoPriceService = require('../utils/cryptoPriceService'); // Load service here
        try {
            this.fiatEquivalentBalance = await cryptoPriceService.convertGoTokenToFiat(this.goTokenBalance, config.defaultFiatCurrency);
        } catch (error) {
            console.error('Error converting GoToken to Fiat during pre-save:', error.message);
            // Decide how to handle this error:
            // 1. Throw error (prevents save)
            // 2. Log and continue with old fiat balance (less accurate, but allows save)
            // For now, we'll log and continue. The balance might be slightly off until next update.
        }
    }
    next();
});


// Instance method to compare passwords
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Optional: Method to check if user changed password after token was issued (for JWT security)
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

module.exports = mongoose.model('User', userSchema);