const User = require('../models/User');
const AppError = require('../utils/AppError');
const bcrypt = require('bcryptjs'); // For password comparison
const emailService = require('../services/emailService');

exports.updateUserInterests = async (userId, interests) => {
    const user = await User.findByIdAndUpdate(userId, { interests: interests }, { new: true, runValidators: true });
    if (!user) {
        throw new AppError('User not found.', 404);
    }
    return user;
};

exports.updateUserLocation = async (userId, country, stateRegion) => {
    const user = await User.findByIdAndUpdate(userId, { country: country, stateRegion: stateRegion }, { new: true, runValidators: true });
    if (!user) {
        throw new AppError('User not found.', 404);
    }
    return user;
};

exports.connectCryptoWallet = async (userId, walletType, address) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Check if wallet already connected
    const existingWallet = user.connectedWallets.find(w => w.walletType === walletType && w.address === address);
    if (existingWallet) {
        throw new AppError('This wallet is already connected.', 400);
    }

    user.connectedWallets.push({ walletType, address });
    await user.save({ runValidators: true });

    return user.connectedWallets;
};

// NEW: Update user profile (username, email, country, state, avatar)
exports.updateUserProfile = async (userId, updateFields) => {
    const user = await User.findById(userId).select('+password'); // Select password for potential comparison later if email changes and re-verification is needed

    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const { username, email, country, stateRegion, avatarUrl } = updateFields;

    // Check for username uniqueness if changed
    if (username && username !== user.username) {
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            throw new AppError('Username is not available. Please try a new username.', 400);
        }
        user.username = username;
    }

    // Check for email uniqueness if changed, and potentially re-verify
    if (email && email !== user.email) {
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            throw new AppError('Email address has been registered before.', 400);
        }
        user.email = email;
        user.emailVerified = false; // Mark as unverified if email changes, requires re-confirmation
        // Trigger email confirmation OTP send here (optional, depends on policy)
        const otpService = require('./otpService');
        const otp = otpService.generateOtp();
        await otpService.saveOtp(user._id, otp);
        await emailService.sendConfirmationEmail(user.email, otp);
        return { user, message: 'Profile updated. Please verify your new email address.' };
    }

    if (country) user.country = country;
    if (stateRegion) user.stateRegion = stateRegion;
    if (avatarUrl) user.avatarUrl = avatarUrl; // Assuming avatarUrl is a public URL after upload

    await user.save({ runValidators: true }); // save will trigger pre-save hooks
    return { user, message: 'Profile updated successfully.' };
};

// NEW: Remove crypto wallet
exports.removeCryptoWallet = async (userId, walletId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const initialLength = user.connectedWallets.length;
    user.connectedWallets = user.connectedWallets.filter(wallet => !wallet._id.equals(walletId));

    if (user.connectedWallets.length === initialLength) {
        throw new AppError('Wallet not found or could not be removed.', 404);
    }

    await user.save({ runValidators: false });
    return user.connectedWallets;
};

// NEW: Change password
exports.changeUserPassword = async (userId, oldPassword, newPassword) => {
    const user = await User.findById(userId).select('+password'); // Select password to compare

    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // 1) Check if old password is correct
    if (!(await user.correctPassword(oldPassword, user.password))) {
        throw new AppError('Your current password is incorrect.', 401);
    }

    // 2) Update password
    user.password = newPassword; // Pre-save hook will hash this
    user.passwordChangedAt = Date.now(); // Optional: Track password change date
    await user.save(); // Save will trigger the pre-save hook to hash the new password

    // Do NOT return the password field
    user.password = undefined;
    return user;
};

// NEW: Update notification preferences
exports.updateNotificationPreferences = async (userId, preferences) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Merge new preferences with existing ones, or set them directly
    user.notificationPreferences = { ...user.notificationPreferences, ...preferences };
    await user.save({ runValidators: false }); // No validation needed for these simple booleans

    return user.notificationPreferences;
};

// NEW: Update privacy settings
exports.updatePrivacySettings = async (userId, settings) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    user.privacySettings = { ...user.privacySettings, ...settings };
    await user.save({ runValidators: false });

    return user.privacySettings;
};

exports.getUserProfile = async (userId) => {
    const user = await User.findById(userId).select('-password -otp -otpExpires'); // Exclude sensitive fields
    if (!user) {
        throw new AppError('User not found.', 404);
    }
    return user;
};