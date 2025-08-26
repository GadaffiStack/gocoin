exports.getUserTaskStats = async (req, res, next) => {
    const stats = await taskService.getUserTaskStats(req.user._id);
    res.status(200).json({ status: 'success', data: stats });
};
// src/controllers/taskController.js
const catchAsync = require('../utils/catchAsync');
const taskService = require('../services/taskService');
const AppError = require('../utils/AppError');

exports.getTasks = async (req, res, next) => {
    const filter = { type: req.query.type };
    const options = {
        limit: parseInt(req.query.limit, 10) || 10,
        page: parseInt(req.query.page, 10) || 1
    };

    const { totalTasks, currentPage, totalPages, tasks } = await taskService.getTasks(filter, options);

    res.status(200).json({
        status: 'success',
        results: tasks.length,
        data: {
            totalTasks,
            currentPage,
            totalPages,
            tasks
        }
    });
};

exports.getTaskDetails = catchAsync(async (req, res, next) => {
    const task = await taskService.getTaskDetails(req.params.id);

    res.status(200).json({
        status: 'success',
        data: {
            task
        }
    });
});

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

exports.submitTask = catchAsync(async (req, res, next) => {
    const { id } = req.params; // taskId
    let submissionData;

    if (req.file) {
        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { resource_type: 'image', folder: 'task_submissions' },
                (error, uploaded) => {
                    if (error) return reject(new AppError('Upload failed', 500));
                    resolve(uploaded.secure_url);
                }
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
        submissionData = uploadResult;
    } else {
        submissionData = req.body.submissionData; // For link submissions
    }

    const result = await taskService.submitTask(req.user._id, id, submissionData);
    // Fetch the task to get the goCoinReward
    const task = await taskService.getTaskDetails(id);

    res.status(200).json({
        status: 'success',
        message: result.message || 'Task submitted successfully for review.',
        userTaskId: result.userTaskId,
        goCoinReward: task.goCoinReward
    });
});

exports.getUserActivity = catchAsync(async (req, res, next) => {
    const filter = { status: req.query.status };
    const options = {
        limit: parseInt(req.query.limit, 10) || 10,
        page: parseInt(req.query.page, 10) || 1
    };

    const { totalActivities, currentPage, totalPages, activities } = await taskService.getUserActivity(req.user._id, filter, options);

    res.status(200).json({
        status: 'success',
        results: activities.length,
        data: {
            totalActivities,
            currentPage,
            totalPages,
            activities
        }
    });
});

// Admin-only (for manual verification, not exposed to users via UI)
exports.completeTaskAdmin = catchAsync(async (req, res, next) => {
    // This route would typically be protected by an admin role middleware
    const { userTaskId } = req.params;
    await taskService.completeTask(userTaskId);

    res.status(200).json({
        status: 'success',
        message: 'User task marked as completed and rewards credited.'
    });
});

// Admin-only (for manual rejection)
exports.rejectTaskAdmin = catchAsync(async (req, res, next) => {
    // This route would typically be protected by an admin role middleware
    const { userTaskId } = req.params;
    const { reason } = req.body;
    await taskService.rejectTask(userTaskId, reason);

    res.status(200).json({
        status: 'success',
        message: 'User task marked as rejected.'
    });
});

exports.createTask = catchAsync(async (req, res, next) => {
    const task = await taskService.createTask(req.body);
    res.status(201).json({
        status: 'success',
        data: { task }
    });
});