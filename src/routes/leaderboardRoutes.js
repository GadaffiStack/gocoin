// src/routes/leaderboardRoutes.js
const express = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const authMiddleware = require('../middlewares/authMiddlewares');
const { validateQuery, getLeaderboardSchema } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/', validateQuery(getLeaderboardSchema), leaderboardController.getLeaderboard);

module.exports = router;