// src/routes/notificationRoutes.js
const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddlewares');
const { validateQuery, getNotificationsSchema } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/all-notification', validateQuery(getNotificationsSchema), notificationController.getNotifications);
router.patch('/:id/read', notificationController.markNotificationAsRead); // PATCH for partial update
router.patch('/mark-all-read', notificationController.markAllNotificationsAsRead);

module.exports = router;