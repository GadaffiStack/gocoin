// src/models/UserTask.js
const mongoose = require('mongoose');

const userTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: [true, 'Task ID is required']
    },
    status: { // Current status of the user's task attempt
        type: String,
        enum: {
            values: ['pending_submission', 'submitted', 'under_review', 'completed', 'rejected'],
            message: '"{VALUE}" is not a valid user task status.'
        },
        default: 'pending_submission'
    },
    submissionData: { // Dynamic field to store submission proof (link, screenshot details, survey answers, code)
        type: mongoose.Schema.Types.Mixed, // Can be a string (link), object (screenshot details), or array (survey answers)
        required: function() { return this.status === 'submitted' || this.status === 'under_review'; } // Required if submitted
    },
    completionDate: {
        type: Date
    },
    rewardEarned: { // Actual reward earned by the user for this task (copied from Task at submission)
        goToken: {
            type: Number,
            min: [0, 'Reward earned cannot be negative']
        },
        fiatEquivalent: {
            type: Number,
            min: [0, 'Fiat reward earned cannot be negative']
        }
    },
    adminNotes: { // For rejection reasons or other notes by admin
        type: String,
        trim: true
    }
}, { timestamps: true });

// Ensure a user can only attempt a unique task once (or modify if multiple attempts are allowed)
// If multiple attempts are allowed, remove this index or make it non-unique and add a version/attempt number.
userTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model('UserTask', userTaskSchema);