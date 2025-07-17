const Notification = require('../models/Notification');
const User = require('../models/User'); // Import User model to check preferences
const AppError = require('../utils/AppError');
const emailService = require('../services/emailService'); // For sending actual emails/SMS
const config = require('../config/config');

exports.createNotification = async (userId, type, message, data = {}) => {
    const user = await User.findById(userId);
    if (!user) {
        console.warn(`Attempted to create notification for non-existent user: ${userId}`);
        return null;
    }

    // Check user's preferences before creating and sending notification
    const { notificationPreferences } = user;
    let shouldCreateInApp = true; // Default to creating in-app notification

    switch (type) {
        case 'new_task_alert':
            shouldCreateInApp = notificationPreferences.newTaskAlerts;
            break;
        case 'task_completed':
            // No specific toggle for this, usually always relevant for in-app
            break;
        case 'reminder':
            shouldCreateInApp = notificationPreferences.taskReminders;
            break;
        case 'referral_joined':
            // Always show in-app for referrals
            break;
        case 'leaderboard_rank_update':
            // Always show in-app for leaderboard updates
            break;
        case 'transaction_status':
            shouldCreateInApp = notificationPreferences.earningsAlerts; // Earnings alerts covers transactions
            break;
        default:
            break;
    }

    let notification = null;
    if (shouldCreateInApp) {
        notification = await Notification.create({
            userId,
            type,
            message,
            data
        });
    }

    // Send email if preferred and email is verified
    if (notificationPreferences.emailNotifications && user.emailVerified) {
        try {
            // Customize email content based on notification type
            let emailSubject = `Go Token Notification: ${type.replace(/_/g, ' ').toUpperCase()}`;
            let emailBody = `<p>${message}</p>`;

            await emailService.sendEmailConfirmation(user.email, emailBody); // Reusing sendEmailConfirmation, but better to have a generic sendNotificationEmail
            // Correct way: await emailService.sendNotificationEmail(user.email, emailSubject, emailBody);
        } catch (error) {
            console.error(`Failed to send email notification to ${user.email} for type ${type}:`, error.message);
        }
    }

    // Send SMS if preferred (and SMS service is enabled/integrated)
    if (notificationPreferences.smsNotifications && user.phoneNumber) { // Assuming user has a phoneNumber field
        try {
            await emailService.sendSms(user.phoneNumber, message); // Reusing emailService as placeholder for SMS
        } catch (error) {
            console.error(`Failed to send SMS notification to ${user.phoneNumber} for type ${type}:`, error.message);
        }
    }

    return notification;
};

exports.getNotifications = async (userId, filter, options) => {
    const { read } = filter;
    const { limit, page } = options;

    const query = { userId };
    if (typeof read === 'boolean') {
        query.read = read;
    }

    const totalNotifications = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        totalNotifications,
        unreadCount,
        notifications,
        currentPage: page,
        totalPages: Math.ceil(totalNotifications / limit)
    };
};

exports.markNotificationAsRead = async (userId, notificationId) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: userId },
        { read: true },
        { new: true }
    );
    if (!notification) {
        throw new AppError('Notification not found or does not belong to this user.', 404);
    }
    return notification;
};

exports.markAllNotificationsAsRead = async (userId) => {
    await Notification.updateMany({ userId: userId, read: false }, { read: true });
    return { message: 'All notifications marked as read.' };
};