// src/routes/referralRoutes.js
const express = require('express');
const referralController = require('../controllers/referallController');
const authMiddleware = require('../middlewares/authMiddlewares');

const router = express.Router();

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/my-code', referralController.getReferralInfo); // Renamed from '/status' for clarity on UI

module.exports = router;