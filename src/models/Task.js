// src/models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    campaignTopic: {
        type: String,
        required: [true, 'Campaign topic is required'],
        trim: true,
        maxlength: [100, 'Campaign topic cannot exceed 100 characters']
    },
    description: { // "This Survey is about dolor sit amet consectetur..."
        type: String,
        required: [true, 'Task description is required'],
        trim: true
    },
    instructions: [{ // Array of strings for numbered instructions
        type: String,
        required: [true, 'Each instruction step is required']
    }],
    rewards: {
        goToken: {
            type: Number,
            required: [true, 'GoToken reward is required'],
            min: [0, 'GoToken reward cannot be negative']
        },
        fiatEquivalent: { // e.g., ~$2.00 (calculated by admin or on the fly)
            type: Number,
            required: [true, 'Fiat equivalent reward is required'],
            min: [0, 'Fiat equivalent reward cannot be negative']
        }
    },
    type: { // e.g., 'social_media', 'content_creation', 'app_download'
        type: String,
        required: [true, 'Task type is required'],
        enum: {
            values: [
                'social_media', 'content_creation', 'app_download', 'survey_polls',
                'videos', 'email_subscription', 'product_testing', 'community',
                'online_purchase_cashback'
            ],
            message: '"{VALUE}" is not a valid task type.'
        }
    },
    submissionMethod: { // How user submits proof, e.g., 'link', 'screenshot', 'code', 'connect_account', 'direct_action'
        type: String,
        required: [true, 'Submission method is required'],
        enum: {
            values: ['link', 'screenshot', 'code', 'connect_account', 'direct_action'],
            message: '"{VALUE}" is not a valid submission method.'
        }
    },
    // Specific requirements based on task type (using Mixed for flexibility, validate in service/controller)
    requirements: {
        socialMediaLinks: [{ // For social_media tasks
            platform: String, // e.g., 'Instagram', 'Twitter', 'Facebook'
            link: String // e.g., link to connect
        }],
        appStoreLink: String, // For app_download
        surveyQuestions: [{ // For survey_polls
            question: String,
            type: { type: String, enum: ['text', 'multiple_choice', 'single_choice'] },
            options: [String] // For multiple/single choice
        }],
        videoUrl: String, // For videos
        emailSubscriptionTarget: String, // For email_subscription (e.g., target email/newsletter name)
        productLink: String, // For product_testing, online_purchase_cashback
        communityLink: String, // For community
        expectedCode: String, // For tasks requiring a code submission
    },
    status: { // Task availability status
        type: String,
        enum: {
            values: ['active', 'inactive'],
            message: 'Status can only be "active" or "inactive".'
        },
        default: 'active'
    },
    // Additional fields like max_submissions, duration, etc. could be added
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);