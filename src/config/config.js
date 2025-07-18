// src/config/config.js
module.exports = {
    port: process.env.PORT || 3000,
    mongoURI: process.env.MONGO_URI || 'mongodb+srv://aqqutelabs:ZECDRlbG5y25uJp7@cluster0.9ck3gvl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    jwtSecret: process.env.JWT_SECRET || 'supersecretjwtkey',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '90d',
    otpExpiresInMinutes: process.env.OTP_EXPIRES_IN_MINUTES || 10, // 10 minutes for OTP (renamed for clarity)
    email: {
        host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
        port: process.env.EMAIL_PORT || 2525,
        secure: process.env.EMAIL_SECURE === 'true' || false,
        user: process.env.EMAIL_USER || 'aqqutelabs@gmail.com',
        password: process.env.EMAIL_PASS || 'vvqgbvylgavunsgi'
    },
    frontendURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    sms: { // Placeholder for SMS service
        apiKey: process.env.SMS_API_KEY || 'your_sms_api_key',
        senderId: process.env.SMS_SENDER_ID || 'GoToken'
    },
    // Example: 1 GoToken = $0.000024 (1/41666.67). Make sure this is updated dynamically or via admin.
    goTokenConversionRateUSD: process.env.GOTOKEN_CONVERSION_RATE_USD || 0.000024,
    referralBonusGoToken: process.env.REFERRAL_BONUS_GOTOKEN || 0.0045, // Example amount
    defaultFiatCurrency: process.env.DEFAULT_FIAT_CURRENCY || 'USD',
    env: process.env.NODE_ENV || 'development'
};


// vvqg bvyl gavu nsgi