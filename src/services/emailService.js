// src/services/emailService.js
const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: config.email.user,
        pass: config.email.password
    }
});

// Send confirmation email with OTP
exports.sendConfirmationEmail = async (email, otp) => {
    const mailOptions = {
        from: `"GoToken" <${config.email.user}>`,
        to: email,
        subject: 'Confirm Your Email Address',
        html: `
            <h1>Welcome to GoToken!</h1>
            <p>Please use the following OTP to confirm your email address:</p>
            <h2>${otp}</h2>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

// Send password reset email with reset link
exports.sendPasswordResetEmail = async (email, resetToken) => {
    const mailOptions = {
        from: `"GoToken" <${config.email.user}>`,
        to: email,
        subject: 'Reset Your Password',
        html: `
            <h1>Password Reset Request</h1>
            <p>You requested to reset your password. Use the token below to reset it in the app or website:</p>
            <h2>${resetToken}</h2>
            <p>This token will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

// Send notification email
exports.sendNotificationEmail = async (email, subject, message) => {
    const mailOptions = {
        from: `"GoToken" <${config.email.user}>`,
        to: email,
        subject: subject,
        html: `
            <h1>${subject}</h1>
            <p>${message}</p>
        `
    };

    await transporter.sendMail(mailOptions);
};