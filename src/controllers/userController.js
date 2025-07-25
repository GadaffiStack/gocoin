const catchAsync = require('../utils/catchAsync');
const userService = require('../services/userService');
const AppError = require('../utils/AppError');
const multer = require('multer'); // For file uploads (avatar)
const cloudinary = require('cloudinary').v2; // For cloud image storage

// Configure Cloudinary (replace with your actual credentials)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for in-memory storage (for Cloudinary upload)
const multerStorage = multer.memoryStorage(); // Store files in memory as buffers

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image! Please upload only images.', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Middleware for uploading single avatar image
exports.uploadUserPhoto = upload.single('avatar'); // Field name 'avatar' from UI

exports.updateInterests = catchAsync(async (req, res, next) => {
    const { interests, userId } = req.body;
    const updatedUser = await userService.updateUserInterests(userId, interests);

    res.status(200).json({
        status: 'success',
        message: 'Interests updated successfully.',
        interests: updatedUser
    });
});

exports.updateLocation = catchAsync(async (req, res, next) => {
    const { country, stateRegion, userId } = req.body;
    const updatedUser = await userService.updateUserLocation(userId, country, stateRegion);

    res.status(200).json({
        status: 'success',
        message: 'Location updated successfully.',
        user: updatedUser // Return full updated user
    });
});

exports.connectWallet = catchAsync(async (req, res, next) => {
    const { walletType, address } = req.body;
    const connectedWallets = await userService.connectCryptoWallet(req.user._id, walletType, address);

    res.status(200).json({
        status: 'success',
        message: 'Wallet connected successfully.',
        connectedWallets
    });
});

// NEW: Update general user profile (username, email, country, state, avatar)

// NEW: Update user profile using userId from body
exports.updateUserProfileWithUserId = catchAsync(async (req, res, next) => {
    const { userId, ...updateFields } = req.body;
    if (!userId) {
        return next(new AppError('userId is required in request body.', 400));
    }
    // If a file was uploaded, upload to Cloudinary and get URL
    if (req.file) {
        try {
            const result = await cloudinary.uploader.upload(
                `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
                {
                    folder: `go-token/avatars/${userId}`,
                    public_id: `avatar_${Date.now()}`
                }
            );
            updateFields.avatarUrl = result.secure_url;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            return next(new AppError('Failed to upload avatar image.', 500));
        }
    }
    // Check if user exists
    const userExists = await userService.getUserProfile(userId);
    if (!userExists) {
        return next(new AppError('User not found.', 404));
    }
    const { user, message } = await userService.updateUserProfile(userId, updateFields);
    res.status(200).json({
        status: 'success',
        message: message,
        data: {
            user: {
                username: user.username,
                email: user.email,
                country: user.country,
                stateRegion: user.stateRegion,
                avatarUrl: user.avatarUrl,
                emailVerified: user.emailVerified
            }
        }
    });
});

// NEW: Remove crypto wallet
exports.removeWallet = catchAsync(async (req, res, next) => {
    const { walletId } = req.params; // Get the subdocument _id from URL params

    const connectedWallets = await userService.removeCryptoWallet(req.user._id, walletId);

    res.status(200).json({
        status: 'success',
        message: 'Wallet removed successfully.',
        connectedWallets
    });
});

// NEW: Change password
exports.changePassword = catchAsync(async (req, res, next) => {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
        return next(new AppError('New password and confirm new password do not match.', 400));
    }

    await userService.changeUserPassword(req.user._id, oldPassword, newPassword);

    res.status(200).json({
        status: 'success',
        message: 'Password changed successfully.'
    });
});

// NEW: Update notification settings
exports.updateNotificationSettings = catchAsync(async (req, res, next) => {
    const preferences = req.body; // Expecting { emailNotifications: true, smsNotifications: false, ... }
    const updatedPreferences = await userService.updateNotificationPreferences(req.user._id, preferences);

    res.status(200).json({
        status: 'success',
        message: 'Notification settings updated successfully.',
        data: {
            notificationPreferences: updatedPreferences
        }
    });
});

// NEW: Update privacy settings
exports.updatePrivacySettings = catchAsync(async (req, res, next) => {
    const settings = req.body; // Expecting { activityVisibility: true, dataSharing: false }
    const updatedSettings = await userService.updatePrivacySettings(req.user._id, settings);

    res.status(200).json({
        status: 'success',
        message: 'Privacy settings updated successfully.',
        data: {
            privacySettings: updatedSettings
        }
    });
});

exports.getMe = catchAsync(async (req, res, next) => {
    const user = await userService.getUserProfile(req.user._id);

    res.status(200).json({
        status: 'success',
        user
    });
});

exports.logout = catchAsync(async (req, res, next) => {
    res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.'
    });
});

exports.getUserInterests = catchAsync(async (req, res, next) => {
    const { userId } = req.body;
    const user = await userService.getUserProfile(userId);
    if (!user) {
        return next(new AppError('User not found.', 404));
    }
    res.status(200).json({
        status: 'success',
        interests: user.interests || []
    });
});