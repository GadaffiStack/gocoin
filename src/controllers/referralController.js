// src/controllers/referralController.js
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get user's referral information
exports.getReferralInfo = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id)
        .select('referralCode referralCount bonusEarned');

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            referralCode: user.referralCode,
            referralCount: user.referralCount,
            bonusEarned: user.bonusEarned
        }
    });
});