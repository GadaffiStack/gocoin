const axios = require('axios');
const AppError = require('../utils/AppError');
const PaymentPage = require('../models/PaymentPage');
const DedicatedAccount = require('../models/DedicatedAccount');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

exports.createDedicatedAccount = async (customerId) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/dedicated_account',
      {
        customer: customerId,
        preferred_bank: 'first-bank',
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    // Store in DB
    const dedicatedAccount = await DedicatedAccount.create({
      customerId,
      ...response.data.data,
    });
    return dedicatedAccount;
  } catch (error) {
    throw new AppError(error.response?.data?.message || 'Failed to create dedicated account', 400);
  }
};

exports.getDedicatedAccount = async (accountNumber) => {
  const account = await DedicatedAccount.findOne({ account_number: accountNumber });
  if (!account) throw new AppError('Dedicated account not found', 404);
  return account;
};

exports.initializePayment = async (email, amount) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100,
        metadata: { description: 'Payment for something' },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    return response.data.data; // includes authorization_url
  } catch (error) {
    throw new AppError(error.response?.data?.message || 'Failed to initialize payment', 400);
  }
};

exports.createPaymentPage = async (name, description, amount, currency = 'NGN') => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/page',
      {
        name,
        description,
        amount: amount ? amount * 100 : undefined,
        currency,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    // Store in DB
    const paymentPage = await PaymentPage.create({
      name,
      description,
      amount,
      currency,
      ...response.data.data,
    });
    return paymentPage;
  } catch (error) {
    throw new AppError(error.response?.data?.message || 'Failed to create payment page', 400);
  }
};

exports.getPaymentPage = async (pageId) => {
  const page = await PaymentPage.findOne({ id: pageId });
  if (!page) throw new AppError('Payment page not found', 404);
  return page;
};
