// src/services/otpService.js
const User = require('../models/User'); // Reusing User model to store OTP
// const otpGenerator = require('../utils/otpGenerator'); // Adjusted path
const config = require('../config/config');

exports.generateOtp = () => {
    // Simple 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.saveOtp = async (userId, otp) => {
    const otpExpires = new Date(Date.now() + config.otpExpiresInMinutes * 60 * 1000);
    await User.findByIdAndUpdate(userId, { otp: otp, otpExpires: otpExpires }, { new: true, runValidators: false });
};

exports.verifyOtp = async (userId, otp) => {
    const user = await User.findById(userId);

    if (!user || !user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
        return false;
    }

    return true;
};