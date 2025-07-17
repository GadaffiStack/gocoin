
const express = require('express');
const authRoutes = require('../routes/authRoutes');
const userRoutes = require('./userRoutes');
const taskRoutes = require('./taskRoutes');
const walletRoutes = require('./walletRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const referralRoutes = require('./referralRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);
router.use('/wallet', walletRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/referral', referralRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;