const Joi = require('joi');
const AppError = require('../utils/AppError');

const validate = (schema, property) => (req, res, next) => {
    let dataToValidate;
    if (property === 'body') {
        dataToValidate = req.body;
    } else if (property === 'params') {
        dataToValidate = req.params;
    } else if (property === 'query') {
        dataToValidate = req.query;
    } else {
        return next(new AppError('Invalid validation property.', 500));
    }

    const { error } = schema.validate(dataToValidate, { abortEarly: false, allowUnknown: true });
    if (error) {
        const message = error.details.map(i => i.message).join(', ');
        return next(new AppError(message, 400));
    }
    next();
};

exports.validateBody = (schema) => validate(schema, 'body');
exports.validateParams = (schema) => validate(schema, 'params');
exports.validateQuery = (schema) => validate(schema, 'query');

// --- Auth Schemas ---
exports.signupSchema = Joi.object({
    username: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(), // Add more complex password regex if needed
    referralCode: Joi.string().optional().allow('')
});

exports.loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

exports.confirmEmailSchema = Joi.object({
    userId: Joi.string().hex().length(24).required(),
    otp: Joi.string().length(6).required()
});

exports.forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required()
});

exports.resetPasswordSchema = Joi.object({
    newPassword: Joi.string().min(6).required(), // Add more complex password regex if needed
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'Password and confirm password do not match'
    })
});

exports.resetPasswordWithOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'Password and confirm password do not match'
    })
});

// --- User Profile Schemas ---
exports.updateInterestsSchema = Joi.object({
    interests: Joi.array().items(Joi.string()).min(1).required()
});

exports.updateLocationSchema = Joi.object({
    country: Joi.string().required(),
    stateRegion: Joi.string().optional().allow('')
});

exports.connectWalletSchema = Joi.object({
    walletType: Joi.string().required(),
    address: Joi.string().required()
});

// NEW: Schema for updating user profile fields
exports.updateProfileSchema = Joi.object({
    username: Joi.string().min(3).optional(),
    email: Joi.string().email().optional(),
    country: Joi.string().optional().allow(''),
    stateRegion: Joi.string().optional().allow(''),
    avatarUrl: Joi.string().uri().optional().allow('') // For direct URL, if not using file upload. If using file upload, this might not be in req.body
}).min(1); // At least one field must be provided for update

// NEW: Schema for changing password
exports.changePasswordSchema = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'New password and confirm new password do not match'
    })
});

// NEW: Schema for notification preferences
exports.notificationSettingsSchema = Joi.object({
    emailNotifications: Joi.boolean().optional(),
    smsNotifications: Joi.boolean().optional(),
    newTaskAlerts: Joi.boolean().optional(),
    taskReminders: Joi.boolean().optional(),
    earningsAlerts: Joi.boolean().optional()
}).min(1);

// NEW: Schema for privacy settings
// Wallet transaction schema
exports.getTransactionsSchema = Joi.object({
    type: Joi.string().optional()
});

exports.privacySettingsSchema = Joi.object({
    activityVisibility: Joi.boolean().optional(),
    dataSharing: Joi.boolean().optional()
}).min(1);


// --- Task Schemas ---
exports.getTasksSchema = Joi.object({
    type: Joi.string().optional().valid(
        'social_media', 'content_creation', 'app_download', 'survey_polls',
        'videos', 'email_subscription', 'product_testing', 'community',
        'online_purchase_cashback'
    ),
    limit: Joi.number().integer().min(1).optional(),
    page: Joi.number().integer().min(1).optional()
});

exports.submitTaskSchema = Joi.object({
    submissionData: Joi.alternatives().try(
        Joi.string(), // For links, codes
        Joi.object({ // For screenshots
            screenshotUrl: Joi.string().uri().required(),
            filename: Joi.string().optional(),
            fileSize: Joi.string().optional() // Or Joi.number() for bytes
        }),
        Joi.array().items(Joi.object({ // For survey answers
            questionId: Joi.string().required(),
            answer: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required()
        }))
    ).required()
});

exports.createTaskSchema = Joi.object({
    campaignTopic: Joi.string().max(100).required(),
    description: Joi.string().required(),
    instructions: Joi.array().items(Joi.string().required()).min(1).required(),
    goCoinReward: Joi.number().min(0).required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    type: Joi.string().valid(
        'social_media', 'content_creation', 'app_download', 'survey_polls',
        'videos', 'email_subscription', 'product_testing', 'community',
        'online_purchase_cashback'
    ).required(),
    submissionMethod: Joi.string().valid(
        'link', 'screenshot', 'code', 'connect_account', 'direct_action'
    ).required(),
    requirements: Joi.object().optional(),
    status: Joi.string().valid('active', 'inactive').optional()
});

// --- Wallet Schemas ---
exports.swapCurrenciesSchema = Joi.object({
    fromCurrency: Joi.string().required(),
    fromAmount: Joi.number().positive().required(),
    toCurrency: Joi.string().required()
});

exports.withdrawConnectedWalletSchema = Joi.object({
    toWalletAddress: Joi.string().required(),
    amountGoToken: Joi.number().positive().required(),
    password: Joi.string().required()
});

exports.withdrawBankSchema = Joi.object({
    accountNumber: Joi.string().required(),
    bankName: Joi.string().required(),
    amountGoToken: Joi.number().positive().optional(),
    amountFiat: Joi.number().positive().optional(),
    fiatCurrency: Joi.string().optional(),
    paymentDescription: Joi.string().optional().allow(''),
    password: Joi.string().required()
}).or('amountGoToken', 'amountFiat'); // Must provide one of the amounts

exports.withdrawMobileMoneySchema = Joi.object({
    mobileNumber: Joi.string().required(),
    network: Joi.string().required(),
    amountGoToken: Joi.number().positive().optional(),
    amountFiat: Joi.number().positive().optional(),
    fiatCurrency: Joi.string().optional(),
    paymentDescription: Joi.string().optional().allow(''),
    password: Joi.string().required()
}).or('amountGoToken', 'amountFiat');

exports.sendCryptoSchema = Joi.object({
    toWalletAddress: Joi.string().required(),
    cryptoType: Joi.string().optional(), // If sending other cryptos
    amount: Joi.number().positive().required(), // Amount in the cryptoType's unit
    paymentDescription: Joi.string().optional().allow(''),
    password: Joi.string().required()
});

exports.sendMobileMoneySchema = Joi.object({
    mobileNumber: Joi.string().required(),
    network: Joi.string().required(),
    amountGoToken: Joi.number().positive().optional(),
    amountFiat: Joi.number().positive().optional(),
    fiatCurrency: Joi.string().optional(),
    paymentDescription: Joi.string().optional().allow(''),
    password: Joi.string().required()
}).or('amountGoToken', 'amountFiat');

exports.sendBankTransferSchema = Joi.object({
    accountNumber: Joi.string().required(),
    bankName: Joi.string().required(),
    beneficiaryName: Joi.string().optional().allow(''),
    amountGoToken: Joi.number().positive().optional(),
    amountFiat: Joi.number().positive().optional(),
    fiatCurrency: Joi.string().optional(),
    paymentDescription: Joi.string().optional().allow(''),
    password: Joi.string().required()
}).or('amountGoToken', 'amountFiat');

exports.addBeneficiarySchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('bank', 'mobile_money', 'crypto').required(),
  details: Joi.alternatives()
    .conditional('type', {
      is: 'bank',
      then: Joi.object({
        accountNumber: Joi.string().required(),
        bankName: Joi.string().required()
      }).required()
    })
    .conditional('type', {
      is: 'mobile_money',
      then: Joi.object({
        mobileNumber: Joi.string().required(),
        network: Joi.string().required()
      }).required()
    })
    .conditional('type', {
      is: 'crypto',
      then: Joi.object({
        walletAddress: Joi.string().required(),
        cryptoType: Joi.string().required()
      }).required()
    })
});

exports.createPaymentLinkSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional().allow(''),
    currency: Joi.string().required() // e.g., 'GoToken', 'USD', 'NGN'
});

exports.saveBankDetailsSchema = Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountName: Joi.string().required()
});

// --- Leaderboard Schemas ---
exports.getLeaderboardSchema = Joi.object({
    period: Joi.string().valid('today', 'this_week', 'this_month').optional(),
    limit: Joi.number().integer().min(1).optional()
});

// --- Notification Schemas ---
exports.getNotificationsSchema = Joi.object({
    read: Joi.boolean().optional(),
    limit: Joi.number().integer().min(1).optional(),
    page: Joi.number().integer().min(1).optional()
});