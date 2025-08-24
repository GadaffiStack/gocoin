const paystackService = require('../services/paystackService');
const catchAsync = require('../utils/catchAsync');

exports.createDedicatedAccount = catchAsync(async (req, res, next) => {
  const { customerId } = req.body;
  const account = await paystackService.createDedicatedAccount(customerId);
  res.status(201).json({ status: 'success', data: account });
});

exports.getDedicatedAccount = catchAsync(async (req, res, next) => {
  const { accountNumber } = req.params;
  const account = await paystackService.getDedicatedAccount(accountNumber);
  res.status(200).json({ status: 'success', data: account });
});

exports.initializePayment = catchAsync(async (req, res, next) => {
  const { email, amount } = req.body;
  const payment = await paystackService.initializePayment(email, amount);
  res.status(201).json({ status: 'success', data: payment });
});

exports.createPaymentPage = catchAsync(async (req, res, next) => {
  const { name, description, amount, currency } = req.body;
  const page = await paystackService.createPaymentPage(name, description, amount, currency);
  res.status(201).json({ status: 'success', data: page });
});

exports.getPaymentPage = catchAsync(async (req, res, next) => {
  const { pageId } = req.params;
  const page = await paystackService.getPaymentPage(pageId);
  // Construct payment link using slug if available, else use id
  let paymentLink = null;
  if (page.slug) {
    paymentLink = `https://paystack.com/pay/${page.slug}`;
  } else if (page.id) {
    paymentLink = `https://dashboard.paystack.com/#/paymentpage/${page.id}`;
  }
  res.status(200).json({ status: 'success', data: { ...page.toObject(), paymentLink } });
});
