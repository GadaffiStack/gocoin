// src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    type: { // e.g., 'new_task_alert', 'task_completed', 'reminder', 'referral_joined', 'leaderboard_rank_update', 'transaction_status'
        type: String,
        required: [true, 'Notification type is required'],
        enum: {
            values: [
                'new_task_alert', 'task_completed', 'reminder',
                'referral_joined', 'leaderboard_rank_update',
                'transaction_status'
            ],
            message: '"{VALUE}" is not a valid notification type.'
        }
    },
    message: {
        type: String,
        required: [true, 'Notification message is required'],
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    },
    data: { // Optional, for dynamic content in message (e.g., {taskTitle: '...', amount: '...'})
        type: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

// Index for faster queries for a user's notifications, sorted by creation date
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 }); // For querying unread notifications

module.exports = mongoose.model('Notification', notificationSchema);