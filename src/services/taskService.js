const cloudinary = require('cloudinary').v2;
const Task = require('../models/Task');
const UserTask = require('../models/UserTask');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const notificationService = require('./notificationService'); // Added notificationService

cloudinary.config({
  cloud_name: "dzsgfbjry",
  api_key: "944916638512926",
  api_secret: "dDX4kmgkYOH_-UxqLPsRkGkdzQw",
});


exports.getTasks = async (filter, options) => {
    const { type, completed } = filter;
    const { limit, page } = options;

    const query = {};
    if (type) query.type = type;
    if (completed === 'true' || completed === true) {
        query.status = 'completed';
    } else {
        query.status = 'active';
    }

    const totalTasks = await Task.countDocuments(query);
    const tasks = await Task.find(query)
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        totalTasks,
        currentPage: page,
        totalPages: Math.ceil(totalTasks / limit),
        tasks
    };
};

exports.getTaskDetails = async (taskId) => {
    const task = await Task.findById(taskId);
    if (!task || task.status === 'inactive') {
        throw new AppError('Task not found or is inactive.', 404);
    }
    return task;
};


// Service function: create or update a UserTask with submissionData
exports.submitTask = async (userId, taskId, submissionData) => {
    // Find or create the UserTask for this user and task
    let userTask = await UserTask.findOne({ userId, taskId });
    const task = await Task.findById(taskId);
    if (!task) throw new AppError('Task not found.', 404);
    if (!userTask) {
        userTask = new UserTask({
            userId,
            taskId,
            status: 'submitted',
            submissionData
        });
    } else {
        // Only allow resubmission if not already completed or rejected
        if (['completed', 'rejected'].includes(userTask.status)) {
            throw new AppError('Cannot submit a completed or rejected task.', 400);
        }
        userTask.status = 'submitted';
        userTask.submissionData = submissionData;
    }
    await userTask.save();
    // Increment user's goCoinBalance by task.goCoinReward
    const user = await User.findById(userId);
    user.goTokenBalance += task.goCoinReward;
    await user.save();
    return {
        message: 'Task submitted successfully for review.',
        userTaskId: userTask._id
    };
};
// Get total tasks and total go coins allocated for a user
exports.getUserTaskStats = async (userId) => {
    const userTasks = await UserTask.find({ userId });
    const taskIds = userTasks.map(ut => ut.taskId);
    const tasks = await Task.find({ _id: { $in: taskIds } });
    const totalGoCoins = tasks.reduce((sum, t) => sum + (t.goCoinReward || 0), 0);
    return {
        totalTasks: userTasks.length,
        totalGoCoins
    };
};

// This function would typically be called by an ADMIN or a background worker after verification.
exports.completeTask = async (userTaskId) => {
    const userTask = await UserTask.findById(userTaskId).populate('userId taskId');
    if (!userTask) {
        throw new AppError('User task not found.', 404);
    }
    if (userTask.status === 'completed') {
        throw new AppError('Task already completed.', 400);
    }
    if (userTask.status === 'rejected') {
        throw new AppError('Task was rejected and cannot be completed.', 400);
    }

    const user = userTask.userId;
    const task = userTask.taskId;

    // Use a MongoDB transaction for atomicity if needed for financial operations
    // For simplicity, directly updating here.
    user.goTokenBalance += task.rewards.goToken;
    user.fiatEquivalentBalance += task.rewards.fiatEquivalent; // Will be updated by pre-save hook too
    await user.save();

    userTask.status = 'completed';
    userTask.completionDate = Date.now();
    await userTask.save();

    // Record the reward as a transaction
    await Transaction.create({
        userId: user._id,
        type: 'task_reward',
        amountGoToken: task.rewards.goToken,
        amountFiat: task.rewards.fiatEquivalent,
        fiatCurrency: config.defaultFiatCurrency, // Assuming default currency for rewards
        status: 'completed',
        details: {
            relatedEntityId: task._id,
            relatedEntityType: 'Task',
            paymentDescription: `Reward for task: ${task.campaignTopic}`
        }
    });

    // Send notification to user
    await notificationService.createNotification(
        user._id,
        'task_completed',
        `Your proof of activity for "${task.campaignTopic}" has been verified, and you've earned ${task.rewards.goToken} Go Tokens!`,
        { taskId: task._id, taskTopic: task.campaignTopic, earnedGoTokens: task.rewards.goToken }
    );

    console.log(`Task ${task.campaignTopic} completed by ${user.username}. Rewards credited.`);
};

// This function would typically be called by an ADMIN or a background worker after verification.
exports.rejectTask = async (userTaskId, reason) => {
    const userTask = await UserTask.findById(userTaskId).populate('userId taskId');
    if (!userTask) {
        throw new AppError('User task not found.', 404);
    }
    if (userTask.status === 'completed') {
        throw new AppError('Cannot reject an already completed task.', 400);
    }

    userTask.status = 'rejected';
    userTask.adminNotes = reason || 'Your submission did not meet the requirements.';
    await userTask.save();

    // Notify user about rejection
    await notificationService.createNotification(
        userTask.userId._id,
        'reminder', // Or 'task_rejected' type
        `Your task "${userTask.taskId.campaignTopic}" was rejected. Reason: ${userTask.adminNotes}.`,
        { taskId: userTask.taskId._id, taskTopic: userTask.taskId.campaignTopic, status: 'rejected' }
    );

    console.log(`Task ${userTask.taskId.campaignTopic} rejected for ${userTask.userId.username}.`);
};

exports.getUserActivity = async (userId, filter, options) => {
    const { status } = filter;
    const { limit, page } = options;

    const query = { userId };
    if (status) query.status = status;

    const totalActivities = await UserTask.countDocuments(query);
    const activities = await UserTask.find(query)
        .populate('taskId', 'campaignTopic rewards type') // Populate only necessary task fields
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        totalActivities,
        currentPage: page,
        totalPages: Math.ceil(totalActivities / limit),
        activities
    };
};

exports.createTask = async (taskData) => {
    const task = await Task.create(taskData);
    return task;
};


exports.reviewSubmittedTask = async (req, res, next) => {
    const { action, reason } = req.body;
    const { userTaskId } = req.params;

    if (!['approve', 'reject'].includes(action)) {
        return next(new AppError('Invalid review action. Use "approve" or "reject".', 400));
    }

    let result;
    if (action === 'approve') {
        result = await taskService.completeTask(userTaskId);
    } else {
        result = await taskService.rejectTask(userTaskId, reason);
    }

    res.status(200).json({
        status: 'success',
        message: `Task ${action}ed successfully.`,
        data: result || null
    });
};