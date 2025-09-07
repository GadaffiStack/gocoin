const express = require('express');
const withdrawalController = require('../controllers/withdrawalController');
const { protect, restrictTo } = require('../middlewares/authMiddlewares');

const router = express.Router();

// User submits withdrawal request
router.post('/', protect, withdrawalController.createWithdrawalRequest);
// Admin fetches all withdrawal requests, filter by user/status
router.get('/', protect, withdrawalController.getWithdrawalRequests);
// Admin updates withdrawal status
router.patch('/:id', protect, withdrawalController.updateWithdrawalStatus);
// User fetches their own withdrawal requests, filtered by status
router.get('/user', protect, withdrawalController.getUserWithdrawalRequests);

module.exports = router;
