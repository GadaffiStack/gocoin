// src/services/authService.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // Added Transaction model
const AppError = require('../utils/AppError');
const { generateToken } = require('../utils/jwt');
const otpService = require('./otpService');
const emailService = require('../services/emailService'); // Adjusted path
const referralGenerator = require('../utils/referralGenerator');
const cryptoPriceService = require('../services/cryptoPriceService'); // Added cryptoPriceService
const notificationService = require('../services/notificationService'); // Added notificationService
const config = require('../config/config');

exports.signup = async (username, email, password, referralCode) => {
    // Check if username already exists
    let existingUser = await User.findOne({ username });
    if (existingUser) {
        throw new AppError('Username is not available. Please try a new username.', 400, { errorType: 'username_taken' });
    }

    // Check if email already exists
    existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('Email address has been registered before.', 400, { errorType: 'email_taken' });
    }

    // Remove manual hashing, let Mongoose pre-save hook handle it
    const userReferralCode = referralGenerator.generate(); // Generate unique referral code for new user
    let referredByUserId = null;
    if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
            referredByUserId = referrer._id;
        } else {
            console.warn(`Referral code ${referralCode} not found.`); // Log, but don't prevent signup
        }
    }

    const newUser = await User.create({
        username,
        email,
        password, // plain password
        emailVerified: false,
        referralCode: userReferralCode,
        referredBy: referredByUserId
    });

    const otp = otpService.generateOtp();
    console.log(`Generated OTP for user ${newUser.email}: ${otp}`);
    await otpService.saveOtp(newUser._id, otp);
    await emailService.sendConfirmationEmail(newUser.email, otp);
    console.log(`Sent confirmation email to ${newUser.email} with OTP: ${otp}`);

    return {
        message: "User registered successfully. Please confirm your email to activate your account.",
        userId: newUser._id,
        otp: otp // Return OTP in response for testing/demo
    };
};

exports.login = async (username, password) => {
    const user = await User.findOne({ username }).select('+password'); // Select password explicitly
    if (!user) {
        console.log('User not found for username:', username);
        throw new AppError('Invalid username or password.', 401);
    }
    console.log('Login attempt:', { username, inputPassword: password, storedPassword: user.password });
    if (!(await user.correctPassword(password, user.password))) {
        console.log('Password mismatch for user:', username);
        throw new AppError('Invalid username or password.', 401);
    }

    if (!user.emailVerified) {
        // Send a new OTP and inform user to verify email
        const otp = otpService.generateOtp();
        await otpService.saveOtp(user._id, otp);
        await emailService.sendConfirmationEmail(user.email, otp);
        throw new AppError('Please confirm your email address to log in. A new OTP has been sent.', 403);
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    return { user, token };
};

exports.confirmEmail = async (userId, otp) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found.', 404);
    }

    if (user.emailVerified) {
        throw new AppError('Email already verified.', 400);
    }

    const isValid = await otpService.verifyOtp(user._id, otp);
    if (!isValid) {
        throw new AppError('Invalid or expired OTP.', 400);
    }

    user.emailVerified = true;
    user.otp = undefined; // Clear OTP fields
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Award referral bonus if referred by someone
    if (user.referredBy) {
        await exports.awardReferralBonus(user.referredBy, user._id);
    }

    const token = generateToken(user._id);
    return { token, user };
};

exports.forgotPassword = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        // To prevent email enumeration, don't reveal if user exists or not
        // Just send a success message as if email was sent
        console.log(`Password reset requested for non-existent email: ${email}`);
        return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetURL = `${config.frontendURL}/reset-password/${resetToken}`;
    console.log('the reset URL:', resetURL);
    await emailService.sendPasswordResetEmail(user.email, resetURL);
};

exports.resetPassword = async (token, newPassword) => {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
        throw new AppError('Invalid or expired password reset token.', 400);
    }

    // Hash and save new password
    user.password = newPassword; // plain password, let pre-save hook hash it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save(); // Mongoose pre-save hook handles hashing

    const authToken = generateToken(user._id);
    return { user, authToken };
};

exports.resendOtp = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const otp = otpService.generateOtp();
    console.log(`Generated new OTP for user ${user.email}: ${otp}`);
    await otpService.saveOtp(user._id, otp);

    if (user.emailVerified) { // If email is already verified, assume this is for password reset
        await emailService.sendPasswordResetEmail(user.email, otp);
    } else { // Otherwise, for email confirmation
        await emailService.sendConfirmationEmail(user.email, otp);
    }
};

exports.resetPasswordWithOtp = async (email, otp, newPassword) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('User not found.', 404);
    }
    // Verify OTP
    const isValid = await otpService.verifyOtp(user._id, otp);
    if (!isValid) {
        throw new AppError('Invalid or expired OTP.', 400);
    }
    user.password = newPassword; // Let Mongoose pre-save hook hash it
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
};

exports.awardReferralBonus = async (referrerId, newUserId) => {
    const referrer = await User.findById(referrerId);
    if (!referrer) return; // Referrer might have been deleted

    // Ensure bonus is only awarded once for a specific referral
    const existingBonusTransaction = await Transaction.findOne({
        userId: referrerId,
        type: 'referral_bonus',
        'details.relatedEntityId': newUserId
    });

    if (existingBonusTransaction) {
        console.warn(`Referral bonus already awarded to ${referrerId} for ${newUserId}`);
        return;
    }

    const bonusGoToken = config.referralBonusGoToken;
    const bonusFiat = await cryptoPriceService.convertGoTokenToFiat(bonusGoToken, config.defaultFiatCurrency);

    referrer.goTokenBalance += bonusGoToken;
    referrer.fiatEquivalentBalance += bonusFiat; // Will be updated by pre-save hook too, but for clarity
    await referrer.save(); // Trigger pre-save hook for fiatEquivalentBalance update

    // Record the bonus as a transaction
    await Transaction.create({
        userId: referrerId,
        type: 'referral_bonus',
        amountGoToken: bonusGoToken,
        amountFiat: bonusFiat,
        fiatCurrency: config.defaultFiatCurrency,
        status: 'completed',
        details: {
            relatedEntityId: newUserId,
            relatedEntityType: 'User',
            paymentDescription: `Bonus for referring user ID: ${newUserId}`
        }
    });

    const newUser = await User.findById(newUserId);
    const referredUsername = newUser ? newUser.username : 'a friend';

    // Notify referrer
    await notificationService.createNotification(
        referrerId,
        'referral_joined',
        `Congratulations! Your friend ${referredUsername} joined Go Token using your referral. You've earned ${bonusGoToken} Go Tokens!`,
        { referredUsername: referredUsername, earnedGoTokens: bonusGoToken }
    );
};