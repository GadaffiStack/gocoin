// src/services/referralService.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const config = require('../config/config');
// const cryptoPriceService = require('../utils/cryptoPriceService');

exports.getReferralInfo = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Count successful referrals (those who joined and completed a task, or simply signed up and verified email)
    const referredUsersCount = await User.countDocuments({ referredBy: userId });

    // Calculate total earnings from referrals
    const referralEarningsTransactions = await Transaction.aggregate([
        {
            $match: {
                userId: userId,
                type: 'referral_bonus',
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalGoTokenEarnings: { $sum: '$amountGoToken' },
                totalFiatEarnings: { $sum: '$amountFiat' } // Assumes fiat equivalent was stored
            }
        }
    ]);

    const totalReferralEarningsGoToken = referralEarningsTransactions.length > 0 ? referralEarningsTransactions[0].totalGoTokenEarnings : 0;
    const totalReferralEarningsFiat = referralEarningsTransactions.length > 0 ? referralEarningsTransactions[0].totalFiatEarnings : 0;


    // Get details of referred friends (can be filtered by status or limited for performance)
    // For simplicity, only returning a count and total earnings for now.
    // If client needs detailed list:
    const referredFriendsList = await User.find({ referredBy: userId })
        .select('username email createdAt emailVerified') // Select only relevant fields
        .limit(10); // Limit for performance if many referrals

    // Map the status for referred friends
    const formattedReferredFriends = referredFriendsList.map(friend => ({
        username: friend.username,
        status: friend.emailVerified ? 'joined_verified' : 'joined_pending_verification',
        date: friend.createdAt.toISOString().split('T')[0] // Format date
    }));


    return {
        referralCode: user.referralCode,
        earningsPerReferral: config.referralBonusGoToken,
        totalReferrals: referredUsersCount,
        successfulReferrals: referralEarningsTransactions.length > 0 ? referralEarningsTransactions[0].totalGoTokenEarnings / config.referralBonusGoToken : 0, // Simplified, assuming each bonus is the fixed amount
        totalReferralEarningsGoToken: totalReferralEarningsGoToken,
        totalReferralEarningsFiat: totalReferralEarningsFiat,
        referredFriends: formattedReferredFriends // Return formatted list
    };
};