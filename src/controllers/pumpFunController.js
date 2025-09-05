const pumpFunService = require('../services/pumpFunService');
const catchAsync = require('../utils/catchAsync');

exports.withdrawGoToken = catchAsync(async (req, res, next) => {
  const { address, amount } = req.body;
  if (!address || !amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid address or amount' });
  }
  try {
    const tx = await pumpFunService.sendGoTokenToUser(address, amount);
    res.status(200).json({ status: 'success', tx });
  } catch (err) {
    console.error('Error in withdrawGoToken:', err);
    res.status(500).json({ status: 'fail', error: err.message || 'Internal error' });
  }
});
