// src/controllers/notificationController.js
const catchAsync = require('../utils/catchAsync');
const notificationService = require('../services/notificationService');

exports.getNotifications = catchAsync(async (req, res, next) => {
    const filter = { read: req.query.read ? (req.query.read === 'true') : undefined };
    const options = {
        limit: parseInt(req.query.limit, 10) || 20,
        page: parseInt(req.query.page, 10) || 1
    };

    const { totalNotifications, unreadCount, notifications, currentPage, totalPages } = await notificationService.getNotifications(req.user._id, filter, options);

    res.status(200).json({
        status: 'success',
        results: notifications.length,
        data: {
            totalNotifications,
            unreadCount,
            notifications,
            currentPage,
            totalPages
        }
    });
});

exports.markNotificationAsRead = catchAsync(async (req, res, next) => {
    await notificationService.markNotificationAsRead(req.user._id, req.params.id);

    res.status(200).json({
        status: 'success',
        message: 'Notification marked as read.'
    });
});

exports.markAllNotificationsAsRead = catchAsync(async (req, res, next) => {
    await notificationService.markAllNotificationsAsRead(req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read.'
    });
});