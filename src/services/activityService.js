const UserTask = require('../models/UserTask');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

function getWeekRange() {
  const now = new Date();
  const start = new Date(now.setDate(now.getDate() - now.getDay())); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

exports.getUserWeeklyActivities = async (userId) => {
  const { start, end } = getWeekRange();

  // --- Fetch tasks submissions ---
  const userTasks = await UserTask.find({
    userId,
    createdAt: { $gte: start, $lte: end }
  }).populate('taskId', 'campaignTopic description rewards type');

  // --- Fetch referral bonuses ---
  const referrals = await Transaction.find({
    userId,
    type: 'referral_bonus',
    createdAt: { $gte: start, $lte: end }
  });

  // --- Calculate total GoToken earned ---
  const earned = userTasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.taskId?.rewards?.goToken || 0), 0)
    + referrals.reduce((sum, r) => sum + (r.amountGoToken || 0), 0);

  // --- Leaderboard calculation ---
  const leaderboardAgg = await Transaction.aggregate([
    { $match: { 
        type: { $in: ['task_reward', 'referral_bonus'] },
        createdAt: { $gte: start, $lte: end }
    }},
    { $group: { _id: "$userId", total: { $sum: "$amountGoToken" } }},
    { $sort: { total: -1 }}
  ]);

  const leaderboardRank = leaderboardAgg.findIndex(x => x._id.toString() === userId.toString()) + 1 || null;

  // --- Format activities ---
  const activities = [];

  userTasks.forEach(t => {
    activities.push({
      title: t.taskId?.campaignTopic || "Task",
      type: t.taskId?.type,
      description: t.taskId?.description,
      reward: t.taskId?.rewards,
      status: t.status
    });
  });

  referrals.forEach(r => {
    activities.push({
      title: "Referral Bonus",
      type: "referral",
      description: "Bonus earned from referral",
      reward: { goToken: r.amountGoToken, fiatEquivalent: r.amountFiat },
      status: r.status === 'completed' ? 'Accepted' : r.status
    });
  });

  return {
    summary: {
      earned,
      leaderboardRank
    },
    activities
  };
};
