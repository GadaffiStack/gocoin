// src/controllers/referralController.js
const catchAsync = require('../utils/catchAsync');
const referralService = require('../services/referralService');

exports.getReferralInfo = catchAsync(async (req, res, next) => {
    const referralInfo = await referralService.getReferralInfo(req.user._id);

    res.status(200).json({
        status: 'success',
        data: referralInfo
    });
});