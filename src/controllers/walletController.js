// src/controllers/walletController.js
const catchAsync = require('../utils/catchAsync');
const walletService = require('../services/walletService');
const AppError = require('../utils/AppError');
// const walletService = require("../services/walletService");

exports.getWalletBalance = catchAsync(async (req, res, next) => {
    const balance = await walletService.getWalletBalance(req.user._id);
    res.status(200).json({
        status: 'success',
        data: balance
    });
});

exports.getTransactions = catchAsync(async (req, res, next) => {
    const filter = { type: req.query.type };
    const options = {
        limit: parseInt(req.query.limit, 10) || 10,
        page: parseInt(req.query.page, 10) || 1
    };

    const { totalTransactions, currentPage, totalPages, transactions } = await walletService.getTransactions(req.user._id, filter, options);

    // Attach amount and method to each transaction
    const transactionsWithAmountAndMethod = transactions.map(tx => ({
        ...tx._doc,
        amount: tx.amountGoToken ?? tx.amountFiat ?? 0,
        method: tx.method || tx.type || 'unknown'
    }));

    res.status(200).json({
        status: 'success',
        results: transactionsWithAmountAndMethod.length,
        data: {
            totalTransactions,
            currentPage,
            totalPages,
            transactions: transactionsWithAmountAndMethod
        }
    });
});

exports.swapCurrencies = catchAsync(async (req, res, next) => {
    const { fromCurrency, fromAmount, toCurrency } = req.body;
    const transaction = await walletService.swapCurrencies(req.user._id, fromCurrency, fromAmount, toCurrency);

    res.status(200).json({
        status: 'success',
        message: 'Currency swap initiated successfully.',
        data: { transaction }
    });
});

exports.withdrawConnectedWallet = catchAsync(async (req, res, next) => {
    const { toWalletAddress, amountGoToken, password } = req.body;
    const transaction = await walletService.withdrawFunds(req.user._id, 'connected', { toWalletAddress, amountGoToken }, password);

    res.status(200).json({
        status: 'success',
        message: 'Withdrawal to connected wallet initiated successfully.',
        data: { transaction }
    });
});

exports.withdrawBank = catchAsync(async (req, res, next) => {
    const { accountNumber, bankName, amountGoToken, amountFiat, fiatCurrency, paymentDescription, password } = req.body;
    const transaction = await walletService.withdrawFunds(req.user._id, 'bank', { accountNumber, bankName, amountGoToken, amountFiat, fiatCurrency, paymentDescription }, password);

    res.status(200).json({
        status: 'success',
        message: 'Bank withdrawal initiated successfully.',
        data: { transaction }
    });
});

exports.withdrawMobileMoney = catchAsync(async (req, res, next) => {
    // console.log('i am the request body', req.body);
    const { mobileNumber, network, amountGoToken, amountFiat, fiatCurrency, password } = req.body;

    const transaction = await walletService.withdrawFunds(
        req.user._id,
        'mobile_money',
        { mobileNumber, network, amountGoToken, amountFiat, fiatCurrency },
        password
    );

    res.status(200).json({
        status: 'success',
        message: 'Mobile money withdrawal initiated successfully.',
        data: { transaction }
    });
});

exports.sendCrypto = catchAsync(async (req, res, next) => {
    const { toWalletAddress, cryptoType, amount, paymentDescription, password } = req.body;
    const transaction = await walletService.sendFunds(req.user._id, 'crypto', { toWalletAddress, cryptoType, amount, paymentDescription }, password);

    res.status(200).json({
        status: 'success',
        message: 'Cryptocurrency sent successfully.',
        data: { transaction }
    });
});

exports.sendMobileMoney = catchAsync(async (req, res, next) => {
    const { mobileNumber, network, amountGoToken, amountFiat, fiatCurrency, paymentDescription } = req.body;
    const transaction = await walletService.sendFunds(req.user._id, 'mobile_money', { mobileNumber, network, amountGoToken, amountFiat, fiatCurrency, paymentDescription }, req.body.password); // Password check implicit here

    res.status(200).json({
        status: 'success',
        message: 'Mobile money transfer initiated successfully.',
        data: { transaction }
    });
});

exports.sendBankTransfer = catchAsync(async (req, res, next) => {
    const { accountNumber, bankName, beneficiaryName, amountGoToken, amountFiat, fiatCurrency, paymentDescription } = req.body;
    const transaction = await walletService.sendFunds(req.user._id, 'bank_transfer', { accountNumber, bankName, beneficiaryName, amountGoToken, amountFiat, fiatCurrency, paymentDescription }, req.body.password);

    res.status(200).json({
        status: 'success',
        message: 'Bank transfer initiated successfully.',
        data: { transaction }
    });
});

exports.sendScanToPay = catchAsync(async (req, res, next) => {
    const { qrCodeData, amountGoToken, paymentDescription, password } = req.body;
    const transaction = await walletService.sendFunds(req.user._id, 'scan_to_pay', { qrCodeData, amountGoToken, paymentDescription }, password);

    res.status(200).json({
        status: 'success',
        message: 'Payment via QR code initiated successfully.',
        data: { transaction }
    });
});

exports.addBeneficiary = catchAsync(async (req, res, next) => {
    const { name, type, details } = req.body;
    const beneficiary = await walletService.addBeneficiary(req.user._id, name, type, details);

    res.status(201).json({
        status: 'success',
        message: 'Beneficiary added successfully.',
        data: { beneficiary }
    });
});

exports.getBeneficiaries = catchAsync(async (req, res, next) => {
    const beneficiaries = await walletService.getBeneficiaries(req.user._id);

    res.status(200).json({
        status: 'success',
        results: beneficiaries.length,
        data: { beneficiaries }
    });
});

exports.createPaymentLink = catchAsync(async (req, res, next) => {
    const { name, description, currency } = req.body;
    const paymentLink = await walletService.createPaymentLink(req.user._id, name, description, currency);

    res.status(201).json({
        status: 'success',
        message: 'Payment link created successfully.',
        data: {
            paymentLink: {
                _id: paymentLink._id,
                name: paymentLink.name,
                linkCode: paymentLink.linkCode,
                // In a real app, you'd construct the full URL here based on frontend domain
                fullUrl: `https://go-coin.vercel.app/pay/${paymentLink.linkCode}`
            }
        }
    });
});

exports.getGoTokenWalletAddress = catchAsync(async (req, res, next) => {
    const address = await walletService.getGoTokenWalletAddress(req.user._id);
    res.status(200).json({
        status: 'success',
        data: { goTokenAddress: address }
    });
});

exports.saveBankDetailsForReceiving = catchAsync(async (req, res, next) => {
    const { bankName, accountNumber, accountName } = req.body;
    const message = await walletService.saveBankDetailsForReceiving(req.user._id, bankName, accountNumber, accountName);

    res.status(200).json({
        status: 'success',
        message: message
    });
});

exports.addWallet = async (req, res, next) => {
  const result = await walletService.addWallet(req.user._id, req.body);

  res.status(201).json({
    status: 'success',
    data: result
  });
};

exports.removeWallet = async (req, res, next) => {
  const { address } = req.body; 

  const result = await walletService.removeWallet(req.user._id, address);

  res.status(200).json({
    status: 'success',
    data: result
  });
};




exports.getWallets = async (req, res, next) => {
  const wallets = await walletService.getUserWallets(req.user._id);

  res.status(200).json({
    status: "success",
    results: wallets.length,
    data: wallets,
  });
};
