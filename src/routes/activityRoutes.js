const express = require('express');
const authMiddleware = require('../middlewares/authMiddlewares');
const activityController = require('../controllers/activityController');

const router = express.Router();

router.get('/weekly', authMiddleware.protect, activityController.getWeeklyActivities);

module.exports = router;
