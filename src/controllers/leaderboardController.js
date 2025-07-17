// src/controllers/leaderboardController.js
const catchAsync = require('../utils/catchAsync');
const leaderboardService = require('../services/leaderboardService');

exports.getLeaderboard = catchAsync(async (req, res, next) => {
    const period = req.query.period; // 'today', 'this_week', 'this_month'
    const limit = parseInt(req.query.limit, 10) || 10;

    const leaderboard = await leaderboardService.getLeaderboard(period, limit);

    // Find the current user's rank if they are authenticated
    let currentUserRank = null;
    if (req.user) {
        const userFound = leaderboard.find(entry => entry.userId.equals(req.user._id));
        if (userFound) {
            currentUserRank = userFound;
        } else {
            // If user is not in the top 'limit', fetch their overall earnings for the period to show their rank
            // This is a more complex query and might hit performance if many users.
            // For now, simplify and just show 'N/A' or calculate their potential rank without fetching full data.
            // A more robust solution involves a separate endpoint for "my rank" or a more complex leaderboard query.
            currentUserRank = {
                username: req.user.username,
                avatarUrl: req.user.avatarUrl || 'https://example.com/default-avatar.png',
                status: req.user.status,
                // Placeholder for actual earnings for the period
                // This would need a separate aggregation specific to the user's earnings for that period
                earningsGoToken: req.user.goTokenBalance, // Simplification, should be period specific
                earningsFiat: req.user.fiatEquivalentBalance, // Simplification, should be period specific
                rank: 'N/A' // Actual calculation is complex without full data
            };
        }
    }


    res.status(200).json({
        status: 'success',
        data: {
            period,
            leaderboard,
            currentUserRank: currentUserRank // Show user's own rank/info
        }
    });
});