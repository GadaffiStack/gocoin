// src/routes/taskRoutes.js
const express = require('express');
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middlewares/authMiddlewares');
const { validateQuery, validateParams, validateBody, getTasksSchema, submitTaskSchema, createTaskSchema } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/me/activity', taskController.getUserActivity);
router.get('/', validateQuery(getTasksSchema), taskController.getTasks);
router.get('/:id', taskController.getTaskDetails);
router.post('/:id/submit', validateBody(submitTaskSchema), taskController.submitTask); // Assuming ID is task ID
// Admin-only route to create a new task
router.post('/',  validateBody(createTaskSchema), taskController.createTask);

// Admin-only routes for task verification (example, not exposed to regular users)
// router.patch('/:userTaskId/complete', authMiddleware.restrictTo('admin'), taskController.completeTaskAdmin);
// router.patch('/:userTaskId/reject', authMiddleware.restrictTo('admin'), taskController.rejectTaskAdmin);

module.exports = router;