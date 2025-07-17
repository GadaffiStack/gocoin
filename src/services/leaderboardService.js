const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const config = require('../config/config');

exports.getLeaderboard = async (period = 'today', limit = 10) => {
    let startDate;
    const now = new Date();

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'this_week':
            // Start of the current week (Sunday)
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            break;
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            throw new AppError('Invalid leaderboard period. Must be "today", "this_week", or "this_month".', 400);
    }

    // Aggregate transactions to calculate earnings within the period
    const earningsAggregation = await Transaction.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate },
                type: { $in: ['task_reward', 'referral_bonus', 'received', 'payment_link_receive'] }, // Only include earning types
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$userId',
                totalGoTokenEarnings: { $sum: '$amountGoToken' }
            }
        },
        {
            $lookup: {
                from: 'users', // The collection name for the User model
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            // NEW: Filter out users who have disabled activity visibility
            $match: {
                'user.privacySettings.activityVisibility': { $ne: false } // Only include if true or undefined
            }
        },
        {
            $project: {
                _id: 0,
                userId: '$user._id',
                username: '$user.username',
                avatarUrl: { $ifNull: ['$user.avatarUrl', 'https://example.com/default-avatar.png'] }, // Assuming an avatarUrl field or default
                status: '$user.status', // Use user's status directly or derive from last activity
                earningsGoToken: '$totalGoTokenEarnings',
                // Calculate fiat equivalent on the fly or use cached GoToken conversion
                earningsFiat: { $multiply: ['$totalGoTokenEarnings', config.goTokenConversionRateUSD] } // Use config value
            }
        },
        {
            $sort: { earningsGoToken: -1 } // Sort by highest earnings
        },
        {
            $limit: limit
        }
    ]);

    // Add ranks
    const leaderboardWithRank = earningsAggregation.map((entry, index) => ({
        rank: index + 1,
        ...entry
    }));

    return leaderboardWithRank;
};