const express = require('express');
const router = express.Router();
const paystackController = require('../controllers/paystackController');

// Dedicated Account
router.post('/dedicated-account', paystackController.createDedicatedAccount);
router.get('/dedicated-account/:accountNumber', paystackController.getDedicatedAccount);

// Payment Initialization
router.post('/initialize-payment', paystackController.initializePayment);

// Payment Page
router.post('/payment-page', paystackController.createPaymentPage);
router.get('/payment-page/:pageId', paystackController.getPaymentPage);

module.exports = router;
