// src/services/referralService.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const config = require('../config/config');
// const cryptoPriceService = require('../utils/cryptoPriceService');

exports.getReferralInfo = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found.', 404);

    // Total invites = all referred users
    const totalInvites = await User.countDocuments({ referredBy: userId });

    // Conversions = referred users who verified email
    const conversions = await User.countDocuments({
        referredBy: userId,
        emailVerified: true
    });

    // Pending bonus = referral bonuses with 'pending' status
    const pendingBonusTx = await Transaction.aggregate([
        {
            $match: {
                userId,
                type: 'referral_bonus',
                status: 'pending'
            }
        },
        {
            $group: {
                _id: null,
                totalGoToken: { $sum: '$amountGoToken' },
                totalFiat: { $sum: '$amountFiat' }
            }
        }
    ]);

    const pendingBonus = pendingBonusTx.length > 0
        ? {
            goToken: pendingBonusTx[0].totalGoToken || 0,
            fiat: pendingBonusTx[0].totalFiat || 0
        }
        : { goToken: 0, fiat: 0 };

    // Completed earnings
    const referralEarningsTx = await Transaction.aggregate([
        {
            $match: {
                userId,
                type: 'referral_bonus',
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalGoTokenEarnings: { $sum: '$amountGoToken' },
                totalFiatEarnings: { $sum: '$amountFiat' }
            }
        }
    ]);

    const totalReferralEarningsGoToken =
        referralEarningsTx.length > 0 ? referralEarningsTx[0].totalGoTokenEarnings : 0;
    const totalReferralEarningsFiat =
        referralEarningsTx.length > 0 ? referralEarningsTx[0].totalFiatEarnings : 0;

    // Referred friends details
    const referredFriendsList = await User.find({ referredBy: userId })
        .select('username email createdAt emailVerified')
        .limit(10);

    const formattedReferredFriends = referredFriendsList.map(friend => ({
        username: friend.username,
        status: friend.emailVerified ? 'joined_verified' : 'joined_pending_verification',
        date: friend.createdAt.toISOString().split('T')[0]
    }));

    return {
        referralCode: user.referralCode,
        earningsPerReferral: config.referralBonusGoToken,
        totalInvites,
        conversions,
        pendingBonus,
        successfulReferrals:
            referralEarningsTx.length > 0
                ? referralEarningsTx[0].totalGoTokenEarnings / config.referralBonusGoToken
                : 0,
        totalReferralEarningsGoToken,
        totalReferralEarningsFiat,
        referredFriends: formattedReferredFriends
    };
};