// src/routes/walletAuthRoutes.js
const express = require('express');
const walletAuthController = require('../controllers/walletAuthController');
const router = express.Router();

// POST /wallet-auth/nonce
router.post('/wallet-auth/nonce', walletAuthController.getNonce);
// POST /wallet-auth/verify
router.post('/wallet-auth/verify', walletAuthController.verifySignature);

module.exports = router;
