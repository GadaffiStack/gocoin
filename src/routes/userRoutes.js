const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddlewares');
const {
    validateBody, validateParams,
    updateInterestsSchema, updateLocationSchema, connectWalletSchema,
    updateProfileSchema, changePasswordSchema, notificationSettingsSchema, privacySettingsSchema
} = require('../middlewares/validationMiddleware'); // Import new schemas
const Joi = require('joi'); // For schema definitions

const router = express.Router();

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/me', userController.getMe);
router.put('/me/interests', validateBody(updateInterestsSchema), userController.updateInterests);
router.put('/me/location', validateBody(updateLocationSchema), userController.updateLocation);
router.post('/me/connect-wallet', validateBody(connectWalletSchema), userController.connectWallet);

// NEW: Edit Profile
router.put(
    '/me/profile',
    userController.uploadUserPhoto, // Handles 'avatar' file upload
    validateBody(updateProfileSchema), // Validate other profile fields
    userController.updateUserProfile
);

// NEW: Remove Wallet
router.delete('/me/connected-wallets/:walletId', validateParams(Joi.object({ walletId: Joi.string().hex().length(24).required() })), userController.removeWallet);

// NEW: Change Password
router.put('/me/password', validateBody(changePasswordSchema), userController.changePassword);

// NEW: Notification Settings
router.put('/me/notification-settings', validateBody(notificationSettingsSchema), userController.updateNotificationSettings);

// NEW: Privacy Settings
router.put('/me/privacy-settings', validateBody(privacySettingsSchema), userController.updatePrivacySettings);

router.post('/logout', userController.logout);

module.exports = router;