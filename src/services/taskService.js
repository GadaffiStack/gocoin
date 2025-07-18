// src/services/taskService.js
const Task = require('../models/Task');
const UserTask = require('../models/UserTask');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const notificationService = require('./notificationService'); // Added notificationService

exports.getTasks = async (filter, options) => {
    const { type } = filter;
    const { limit, page } = options;

    const query = {};
    if (type) query.type = type;
    query.status = 'active'; // Only show active tasks

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

exports.submitTask = async (userId, taskId, submissionData) => {
    const task = await Task.findById(taskId);
    if (!task) {
        throw new AppError('Task not found.', 404);
    }

    if (task.status === 'inactive') {
        throw new AppError('This task is currently inactive.', 400);
    }

    // Check if user has already submitted and it's pending/completed/under review
    let userTask = await UserTask.findOne({
        userId,
        taskId,
        status: { $in: ['pending_submission', 'submitted', 'under_review', 'completed'] }
    });

    if (userTask && userTask.status === 'completed') {
        throw new AppError('You have already completed this task.', 400);
    }
    if (userTask && userTask.status === 'submitted' || userTask.status === 'under_review') {
        throw new AppError('You have already submitted this task, and it is under review.', 400);
    }

    // Create or update userTask entry
    if (userTask) {
        userTask.submissionData = submissionData;
        userTask.status = 'submitted';
        userTask.completionDate = undefined; // Reset completion date if resubmitting
    } else {
        userTask = new UserTask({
            userId,
            taskId,
            submissionData,
            status: 'submitted',
            rewardEarned: task.rewards // Store initial reward amount
        });
    }

    await userTask.save();

    // In a real system, this would trigger an admin review process.
    // For this demo, we can simulate an immediate approval or set it to 'under_review'.
    // For now, it stays 'submitted' and needs admin approval to change to 'completed'.
    // Or, for tasks like 'watch video' with a code, it could be auto-verified.
    // Let's assume manual review for all screenshot/link submissions and auto for 'code' tasks.

    // Example auto-verification for 'code' submission
    if (task.submissionMethod === 'code' && task.requirements.expectedCode) {
        if (submissionData === task.requirements.expectedCode) {
            await exports.completeTask(userTask._id);
            return { message: 'Task submitted and auto-verified successfully!' };
        } else {
            userTask.status = 'rejected';
            userTask.adminNotes = 'Incorrect code submitted.';
            await userTask.save();
            throw new AppError('Incorrect code. Task submission rejected.', 400);
        }
    }

    await notificationService.createNotification(
        userId,
        'reminder', // Or 'task_submitted' type
        `Your task "${task.campaignTopic}" has been submitted and is under review.`,
        { taskId: task._id, taskTopic: task.campaignTopic, status: 'under_review' }
    );

    return { message: 'Task submitted successfully and is awaiting review.' };
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