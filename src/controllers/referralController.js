// src/controllers/referralController.js
const referralService = require('../services/referralService');




exports.getReferralInfo = async (req, res, next) => {
    const referralInfo = await referralService.getReferralInfo(req.user._id);
    res.status(200).json({
        status: 'success',
        data: referralInfo
    });
};