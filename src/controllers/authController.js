// src/controllers/authController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');

exports.signup = async (req, res, next) => {
    const { username, email, password, referralCode } = req.body;

    const { user, token, message, userId } = await authService.signup(username, email, password, referralCode);

    if (token) { // If email confirmation is not required/already handled
        res.status(200).json({
            status: 'success',
            message,
            token,
            user
        });
    } else { // If email confirmation is pending
        res.status(202).json({ // 202 Accepted, processing not complete
            status: 'success',
            message,
            userId // Pass userId back for email confirmation step
        });
    }
};

exports.login = catchAsync(async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return next(new AppError('Please provide username and password!', 400));
    }

    const { user, token } = await authService.login(username, password);

    res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            goTokenBalance: user.goTokenBalance,
            fiatEquivalentBalance: user.fiatEquivalentBalance,
            // Add other user fields needed on login
        }
    });
});

exports.confirmEmail = catchAsync(async (req, res, next) => {
    const { userId, otp } = req.body;
    const { token, user } = await authService.confirmEmail(userId, otp);

    res.status(200).json({
        status: 'success',
        message: 'Email confirmed successfully. Account activated.',
        token,
        user: { // Return necessary user details for client
            _id: user._id,
            username: user.username,
            email: user.email,
            goTokenBalance: user.goTokenBalance,
            fiatEquivalentBalance: user.fiatEquivalentBalance,
        }
    });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    await authService.forgotPassword(email);

    res.status(200).json({
        status: 'success',
        message: 'Password reset instructions sent to your email.'
    });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;
    
    if (newPassword !== confirmPassword) {
        return next(new AppError('Passwords do not match', 400));
    }
    
    const authToken = await authService.resetPassword(token, newPassword);

    res.status(200).json({
        status: 'success',
        message: 'Password reset successful',
        token: authToken
    });
});

exports.resendOtp = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    await authService.resendOtp(email);

    res.status(200).json({
        status: 'success',
        message: 'New OTP has been sent to your email.'
    });
});

exports.resetPasswordWithOtp = catchAsync(async (req, res, next) => {
    const { email, otp, newPassword } = req.body;
    await authService.resetPasswordWithOtp(email, otp, newPassword);
    res.status(200).json({
        status: 'success',
        message: 'Password reset successful.'
    });
});