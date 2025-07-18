// src/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const { validateBody, signupSchema, loginSchema, confirmEmailSchema, forgotPasswordSchema, resetPasswordSchema, resendOtpSchema, resetPasswordWithOtpSchema } = require('../middlewares/validationMiddleware');

const router = express.Router();

router.post('/signup', validateBody(signupSchema), authController.signup);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/confirm-email', validateBody(confirmEmailSchema), authController.confirmEmail);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password/:token', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/resend-otp', authController.resendOtp);
router.post('/reset-password', validateBody(resetPasswordWithOtpSchema), authController.resetPasswordWithOtp);

module.exports = router;