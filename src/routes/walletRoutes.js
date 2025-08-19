// src/routes/walletRoutes.js
const express = require('express');
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddlewares');
const Joi = require('joi');
const {
    validateBody, validateQuery,
    swapCurrenciesSchema, withdrawConnectedWalletSchema, withdrawBankSchema, withdrawMobileMoneySchema,
    sendCryptoSchema, sendMobileMoneySchema, sendBankTransferSchema, addBeneficiarySchema,
    createPaymentLinkSchema, saveBankDetailsSchema, getTransactionsSchema
} = require('../middlewares/validationMiddleware');

const router = express.Router();

const sendScanToPaySchema = Joi.object({
  qrCodeData: Joi.string().required(),
  amountGoToken: Joi.number().positive().required(),
  paymentDescription: Joi.string().optional(),
  password: Joi.string().required()
});

router.use(authMiddleware.protect); // All routes after this are protected

router.get('/balance', walletController.getWalletBalance);
router.get('/transactions', validateQuery(getTransactionsSchema), walletController.getTransactions);

// Swap
router.post('/swap', validateBody(swapCurrenciesSchema), walletController.swapCurrencies);

// Withdrawals
router.post('/withdraw/connected', validateBody(withdrawConnectedWalletSchema), walletController.withdrawConnectedWallet);
router.post('/withdraw/bank', validateBody(withdrawBankSchema), walletController.withdrawBank);
router.post('/withdraw/mobile-money', validateBody(withdrawMobileMoneySchema), walletController.withdrawMobileMoney);

// Send Payments
router.post('/send/crypto', validateBody(sendCryptoSchema), walletController.sendCrypto);
router.post('/send/mobile-money', validateBody(sendMobileMoneySchema), walletController.sendMobileMoney);
router.post('/send/bank-transfer', validateBody(sendBankTransferSchema), walletController.sendBankTransfer);

router.post(
  '/send/scan-to-pay',
  validateBody(sendScanToPaySchema),
  walletController.sendScanToPay
);
// Beneficiaries
router.post('/beneficiaries', validateBody(addBeneficiarySchema), walletController.addBeneficiary);
router.get('/beneficiaries', walletController.getBeneficiaries);

// Receive Payments
router.post('/receive/payment-link', validateBody(createPaymentLinkSchema), walletController.createPaymentLink);
router.get('/receive/address', walletController.getGoTokenWalletAddress);
router.post('/receive/bank-details', validateBody(saveBankDetailsSchema), walletController.saveBankDetailsForReceiving);

router.post('/add-wallet', walletController.addWallet);

router.delete('/remove-wallet', walletController.removeWallet);

router.get("/get-wallet",  walletController.getWallets);

module.exports = router;