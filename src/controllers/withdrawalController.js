const WithdrawalRequest = require('../models/WithdrawalRequest');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// User submits withdrawal request
exports.createWithdrawalRequest = catchAsync(async (req, res, next) => {
    const { amount, walletAddress } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0 || !walletAddress) {
        return res.status(400).json({ error: 'Invalid amount or wallet address' });
    }
    // Prevent duplicate pending requests
    const existing = await WithdrawalRequest.findOne({ user: req.user._id, status: 'pending' });
    if (existing) {
        return res.status(400).json({ error: 'You already have a pending withdrawal request.' });
    }
    const withdrawal = await WithdrawalRequest.create({
        user: req.user._id,
        amount,
        walletAddress
    });
    res.status(201).json({
        status: 'success',
        withdrawal: {
            amount: withdrawal.amount,
            walletAddress: withdrawal.walletAddress,
            status: withdrawal.status
        }
    });
});

// Admin fetches all withdrawal requests, filter by user
exports.getWithdrawalRequests = catchAsync(async (req, res, next) => {
  const { userId, status } = req.query;
  const filter = {};
  if (userId) filter.user = userId;
  if (status) filter.status = status;
  const withdrawals = await WithdrawalRequest.find(filter).populate('user');
  res.status(200).json({ status: 'success', withdrawals });
});

// Admin marks withdrawal as approved/rejected
exports.updateWithdrawalStatus = catchAsync(async (req, res, next) => {
  const { status, txHash } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const withdrawal = await WithdrawalRequest.findById(req.params.id);
  if (!withdrawal) return next(new AppError('Withdrawal request not found', 404));
  withdrawal.status = status;
  if (txHash) withdrawal.txHash = txHash;
  await withdrawal.save();
  res.status(200).json({ status: 'success', withdrawal });
});
