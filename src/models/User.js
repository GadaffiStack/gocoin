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
    // --- Socials & Phone ---
    telegram: { type: String, trim: true },
    x: { type: String, trim: true },
    instagram: { type: String, trim: true },
    discord: { type: String, trim: true },
    facebook: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },

    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    interests: [{
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
    country: { type: String, trim: true },
    stateRegion: { type: String, trim: true },

    connectedWallets: [{
        walletType: { type: String, required: [true, 'Wallet type is required'] },
        address: { type: String, required: [true, 'Wallet address is required'] }
    }],

    goTokenBalance: { type: Number, default: 0, min: [0, 'Balance cannot be negative'] },
    fiatEquivalentBalance: { type: Number, default: 0, min: [0, 'Balance cannot be negative'] },

    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true,
        minlength: [8, 'Referral code must be at least 8 characters']
    },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    bonusEarned: { type: Number, default: 0 },

    status: {
        type: String,
        enum: {
            values: ['active', 'inactive'],
            message: 'Status can only be "active" or "inactive".'
        },
        default: 'active'
    },

    lastLogin: { type: Date, default: Date.now },

    avatarUrl: {
        type: String,
        default: 'https://res.cloudinary.com/your-cloud-name/image/upload/v1709280000/default-avatar.png'
    },

    notificationPreferences: {
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: false },
        newTaskAlerts: { type: Boolean, default: true },
        taskReminders: { type: Boolean, default: true },
        earningsAlerts: { type: Boolean, default: true }
    },

    privacySettings: {
        activityVisibility: { type: Boolean, default: true },
        dataSharing: { type: Boolean, default: false }
    },

    bankReceiveDetails: {
        bankName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        accountName: { type: String, trim: true }
    },

    passwordChangedAt: Date

}, { timestamps: true });

// --- Hooks ---
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.pre('save', function(next) {
    if (!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

userSchema.pre('save', async function(next) {
    if (this.isModified('goTokenBalance')) {
        const config = require('../config/config');
        const cryptoPriceService = require('../services/cryptoPriceService');
        try {
            this.fiatEquivalentBalance = await cryptoPriceService.convertGoTokenToFiat(
                this.goTokenBalance,
                config.defaultFiatCurrency
            );
        } catch (error) {
            console.error('Error converting GoToken to Fiat during pre-save:', error.message);
        }
    }
    next();
});

// --- Methods ---
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

module.exports = mongoose.model('User', userSchema);
