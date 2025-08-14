const express = require('express');
const Joi = require('joi');

const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddlewares');
const {
    validateBody,
    validateParams,
    updateInterestsSchema,
    updateLocationSchema,
    connectWalletSchema,
    updateProfileSchema,
    changePasswordSchema,
    notificationSettingsSchema,
    privacySettingsSchema
} = require('../middlewares/validationMiddleware');

const router = express.Router();

// =========================
// User Profile & Account
// =========================
router.get('/me', authMiddleware.protect, userController.getMe);

router.put(
    '/me/profile',
    userController.uploadUserPhoto, // Handles 'avatar' file upload
    validateBody(updateProfileSchema), // Validate other profile fields
    userController.updateUserProfileWithUserId
);

router.put('/me/password', validateBody(changePasswordSchema), userController.changePassword);

router.post('/logout', userController.logout);

// =========================
// Location Updates
// =========================
router.put(
    '/me/country',
    authMiddleware.protect,
    validateBody(Joi.object({ country: Joi.string().required() })),
    userController.updateCountry
);

router.put(
    '/me/state',
    authMiddleware.protect,
    validateBody(Joi.object({ state: Joi.string().required() })),
    userController.updateState
);

router.put('/me/location', validateBody(updateLocationSchema), userController.updateLocation);


router.put(
    '/me/socials/telegram',
    authMiddleware.protect,
    validateBody(Joi.object({ telegram: Joi.string().required() })),
    userController.updateTelegram
);

router.put(
    '/me/socials/x',
    authMiddleware.protect,
    validateBody(Joi.object({ x: Joi.string().required() })),
    userController.updateX
);

router.put(
    '/me/socials/instagram',
    authMiddleware.protect,
    validateBody(Joi.object({ instagram: Joi.string().required() })),
    userController.updateInstagram
);

router.put(
    '/me/socials/discord',
    authMiddleware.protect,
    validateBody(Joi.object({ discord: Joi.string().required() })),
    userController.updateDiscord
);

router.put(
    '/me/socials/facebook',
    authMiddleware.protect,
    validateBody(Joi.object({ facebook: Joi.string().required() })),
    userController.updateFacebook
);

router.put(
    '/me/phone',
    authMiddleware.protect,
    validateBody(Joi.object({ phoneNumber: Joi.string().required() })),
    userController.updatePhoneNumber
);

// =========================
// Interests
// =========================
router.put('/me/interests', validateBody(updateInterestsSchema), userController.updateInterests);

router.post('/me/interests/fetch', authMiddleware.protect, userController.getUserInterests);

// =========================
// Wallet Management
// =========================
router.post('/me/connect-wallet', validateBody(connectWalletSchema), userController.connectWallet);

router.delete(
    '/me/connected-wallets/:walletId',
    validateParams(Joi.object({ walletId: Joi.string().hex().length(24).required() })),
    userController.removeWallet
);

// =========================
// Preferences
// =========================
router.put(
    '/me/notification-settings',
    authMiddleware.protect,
    validateBody(notificationSettingsSchema),
    userController.updateNotificationSettings
);

router.put(
    '/me/privacy-settings',
    authMiddleware.protect,
    validateBody(privacySettingsSchema),
    userController.updatePrivacySettings
);

module.exports = router;
