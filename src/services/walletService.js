// src/services/walletService.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Beneficiary = require('../models/Beneficiary');
const PaymentLink = require('../models/PaymentLink');
const AppError = require('../utils/AppError');
const cryptoPriceService = require('./cryptoPriceService');
const paymentGatewayService = require('./paymentGatewayService');
const notificationService = require('./notificationService');
const config = require('../config/config');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios'); // For API calls

exports.getWalletBalance = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }
    // Balance is automatically updated by pre-save hook in User model
    return {
        goTokenBalance: user.goTokenBalance,
        fiatEquivalent: user.fiatEquivalentBalance,
        fiatCurrency: config.defaultFiatCurrency
    };
};

exports.getTransactions = async (userId, filter, options) => {
    const { type } = filter;
    const { limit, page } = options;

    const query = { userId };
    if (type) query.type = type;

    const totalTransactions = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    return {
        totalTransactions,
        currentPage: page,
        totalPages: Math.ceil(totalTransactions / limit),
        transactions
    };
};

exports.swapCurrencies = async (userId, fromCurrency, fromAmount, toCurrency) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (!user) throw new AppError('User not found.', 404);

        const exchangeRate = await cryptoPriceService.getExchangeRate(fromCurrency, toCurrency);
        if (!exchangeRate) {
            throw new AppError('Exchange rate not available for this pair.', 400);
        }

        const toAmount = fromAmount * exchangeRate;
        const feeGoToken = fromAmount * 0.001; // 0.1% swap fee in GoToken
        const netFromAmount = fromAmount + (fromCurrency === 'GoToken' ? feeGoToken : 0); // Fee only applies to GoToken

        // Handle balance deduction based on currency type
        if (fromCurrency === 'GoToken') {
            console.log('go token balance', user.goTokenBalance, netFromAmount);
            if (user.goTokenBalance < netFromAmount) {
                throw new AppError('Insufficient GoToken balance for swap including fee.', 400);
            }
            user.goTokenBalance -= netFromAmount;
        } else if (fromCurrency === 'BTC') {
            // Assume an external wallet or external balance field (e.g., user.btcBalance)
            if (!user.btcBalance || user.btcBalance < fromAmount) {
                throw new AppError('Insufficient BTC balance.', 400);
            }
            user.btcBalance -= fromAmount; // Deduct BTC from user's balance
            // Optionally, convert fee to BTC if external wallet supports it
            const feeInBtc = feeGoToken * (await cryptoPriceService.getExchangeRate('GoToken', 'BTC'));
            user.btcBalance -= feeInBtc; // Deduct fee in BTC
        } else {
            throw new AppError(`Swap from ${fromCurrency} not yet supported for in-app balance.`, 400);
        }

        await user.save({ session }); // This will trigger pre-save hook for fiat equivalent

        const transaction = await Transaction.create([{
            userId: userId,
            type: 'swap',
            amountGoToken: fromCurrency === 'GoToken' ? -netFromAmount : 0, // Only for GoToken swaps
            amountFiat: await cryptoPriceService.convertGoTokenToFiat(
                fromCurrency === 'GoToken' ? -netFromAmount : 0,
                config.defaultFiatCurrency
            ),
            fiatCurrency: config.defaultFiatCurrency,
            status: 'completed', // Assuming instant swap
            feeGoToken: fromCurrency === 'GoToken' ? feeGoToken : 0, // Fee in GoToken only for GoToken swaps
            feeBtc: fromCurrency === 'BTC' ? feeInBtc : 0, // Fee in BTC for BTC swaps
            details: {
                fromCurrency: fromCurrency,
                toCurrency: toCurrency,
                fromAmount: fromAmount,
                toAmount: toAmount,
                exchangeRate: exchangeRate
            }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return transaction[0];
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error; // Re-throw the error for global handler
    }
};

exports.withdrawFunds = async (userId, withdrawalType, details, password) => {
    console.log(' i am the details', details);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).select('+password').session(session);
        if (!user) throw new AppError('User not found.', 404);

        if (!(await user.correctPassword(password, user.password))) {
            throw new AppError('Incorrect password. Please try again.', 401);
        }

        let amountGoToken = details.amountGoToken;
        let amountFiat = details.amountFiat;
        const fiatCurrency = details.fiatCurrency || config.defaultFiatCurrency;

        if (amountFiat) {
            amountGoToken = await cryptoPriceService.convertFiatToGoToken(amountFiat, fiatCurrency);
        } else if (amountGoToken) {
            amountFiat = await cryptoPriceService.convertGoTokenToFiat(amountGoToken, fiatCurrency);
        } else {
            throw new AppError('Either amountGoToken or amountFiat must be provided.', 400);
        }

        // Apply a base withdrawal fee in GoTokens (example: 0.00001 GoToken)
        const baseWithdrawalFeeGoToken = 0.00001;
        // Or a percentage fee
        const percentageFeeRate = 0.005; // 0.5%
        const percentageFeeGoToken = amountGoToken * percentageFeeRate;
        const totalFeeGoToken = baseWithdrawalFeeGoToken + percentageFeeGoToken;

        const totalGoTokenToDeduct = amountGoToken + totalFeeGoToken;

        if (user.goTokenBalance < totalGoTokenToDeduct) {
            throw new AppError('Insufficient GoToken balance for withdrawal including fees.', 400);
        }

        user.goTokenBalance -= totalGoTokenToDeduct;
        await user.save({ session });

        let transactionDetails = {
            userId: userId,
            amountGoToken: -amountGoToken, // Negative for outgoing
            amountFiat: -amountFiat,
            fiatCurrency: fiatCurrency,
            feeGoToken: totalFeeGoToken,
            status: 'pending', // Withdrawals might be pending external processing
            details: {
                paymentDescription: details.paymentDescription || 'Go Token Withdrawal'
            }
        };

        let withdrawalResult;
        let transactionType;

        switch (withdrawalType) {
            case 'connected':
                // For connected wallets, we assume the address is already validated/stored
                const connectedWallet = user.connectedWallets.find(w => w.address === details.toWalletAddress);
                if (!connectedWallet) {
                    throw new AppError('Connected wallet address not found.', 400);
                }
                transactionType = 'crypto_send'; // Treat as a crypto send to connected wallet
                withdrawalResult = await paymentGatewayService.processCryptoTransfer(
                    details.toWalletAddress,
                    'GoToken', // Assuming GoTokens are sent directly
                    amountGoToken
                );
                transactionDetails.transactionId = withdrawalResult.transactionHash;
                transactionDetails.status = withdrawalResult.status;
                transactionDetails.details.toWalletAddress = details.toWalletAddress;
                transactionDetails.details.cryptoType = 'GoToken';
                transactionDetails.details.networkFee = withdrawalResult.networkFee || 0;
                break;

            case 'bank':
                transactionType = 'bank_withdraw';
                // FIXED: Corrected parameter order to match processBankTransfer function signature
                // processBankTransfer(userId, amountFiat, fiatCurrency, accountNumber, bankName, paymentDescription)
                withdrawalResult = await paymentGatewayService.processBankTransfer(
                    userId,                        // userId (1st parameter)
                    amountFiat,                    // amountFiat (2nd parameter)
                    fiatCurrency,                  // fiatCurrency (3rd parameter)
                    details.accountNumber,         // accountNumber (4th parameter)
                    details.bankName,              // bankName (5th parameter)
                    details.paymentDescription     // paymentDescription (6th parameter)
                );
                transactionDetails.transactionId = withdrawalResult.transactionId || 'sfasdfda';
                transactionDetails.status = withdrawalResult.status;
                transactionDetails.details.accountNumber = details.accountNumber;
                transactionDetails.details.bankName = details.bankName;
                transactionDetails.details.beneficiaryName = details.beneficiaryName; // If applicable
                // Note: withdrawalResult.fee might be different from transactionDetails.feeGoToken
                // Need to decide if fees are shown in fiat or GoToken to user
                break;

            case 'mobile_money':
                transactionType = 'mobile_money_withdraw';
                withdrawalResult = await paymentGatewayService.processMobileMoneyTransfer(
                    details.mobileNumber,
                    details.network,
                    amountFiat,
                    fiatCurrency,
                    details.paymentDescription
                );
                transactionDetails.transactionId = withdrawalResult.transactionId;
                transactionDetails.status = withdrawalResult.status;
                transactionDetails.details.mobileNumber = details.mobileNumber;
                transactionDetails.details.mobileNetwork = details.network;
                break;

            default:
                throw new AppError('Invalid withdrawal type.', 400);
        }

        const transaction = await Transaction.create([transactionDetails], { session });

        await session.commitTransaction();
        session.endSession();

        // Send notification
        await notificationService.createNotification(
            userId,
            'transaction_status',
            `Your withdrawal of ${amountGoToken} GoTokens (${amountFiat} ${fiatCurrency}) is ${transactionDetails.status}. ID: ${transaction[0].transactionId}`,
            { transactionId: transaction[0]._id, type: transactionType, amountGoToken, status: transactionDetails.status }
        );

        return transaction[0];
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

exports.sendFunds = async (userId, sendType, details, password) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).select('+password').session(session);
        if (!user) throw new AppError('User not found.', 404);

        if (!(await user.correctPassword(password, user.password))) {
            throw new AppError('Incorrect password. Please try again.', 401);
        }

        let amountGoToken = details.amountGoToken;
        let amountFiat = details.amountFiat;
        const fiatCurrency = details.fiatCurrency || config.defaultFiatCurrency;

        if (amountFiat) {
            amountGoToken = await cryptoPriceService.convertFiatToGoToken(amountFiat, fiatCurrency);
        } else if (amountGoToken) {
            amountFiat = await cryptoPriceService.convertGoTokenToFiat(amountGoToken, fiatCurrency);
        } else {
            throw new AppError('Either amountGoToken or amountFiat must be provided.', 400);
        }

        // Apply fees for sending (can be percentage or fixed)
        const sendFeeRate = 0.002; // 0.2% send fee
        const sendFeeGoToken = amountGoToken * sendFeeRate;
        const totalGoTokenToDeduct = amountGoToken + sendFeeGoToken;

        if (user.goTokenBalance < totalGoTokenToDeduct) {
            throw new AppError('Insufficient GoToken balance for sending including fees.', 400);
        }

        user.goTokenBalance -= totalGoTokenToDeduct;
        await user.save({ session });

        let transactionDetails = {
            userId: userId,
            amountGoToken: -amountGoToken, // Negative for outgoing
            amountFiat: -amountFiat,
            fiatCurrency: fiatCurrency,
            feeGoToken: sendFeeGoToken,
            status: 'pending',
            details: {
                paymentDescription: details.paymentDescription || 'Go Token Payment'
            }
        };

        let sendResult;
        let transactionType;

        switch (sendType) {
            case 'crypto':
                transactionType = 'crypto_send';
                sendResult = await axios.post('https://api.nowpayments.io/v1/payment', {
                    price_amount: amountGoToken,
                    price_currency: 'usd', // Adjust based on your app's currency
                    pay_currency: details.cryptoType || 'BTC', // Default to Bitcoin
                    ipn_callback_url: config.nowPaymentsCallbackUrl,
                    order_id: `SEND_${userId}_${Date.now()}`,
                    order_description: details.paymentDescription || 'GoToken Payment'
                }, {
                    headers: {
                        'x-api-key': process.env.NOWPAYMENTS_API_KEY
                    }
                });
                transactionDetails.transactionId = sendResult.data.payment_id;
                transactionDetails.status = sendResult.data.payment_status;
                transactionDetails.details.toWalletAddress = details.toWalletAddress;
                transactionDetails.details.cryptoType = details.cryptoType || 'BTC';
                break;
            case 'scan_to_pay':
                    transactionType = 'scan_to_pay';
                    
                    // Lookup merchant or recipient from QR code data
                    const merchant = await User.findOne({ qrCodeId: details.qrCodeData }).session(session);
                    if (!merchant) {
                        throw new AppError('Merchant not found for this QR code.', 404);
                    }

                    // Credit merchant's wallet
                    merchant.goTokenBalance += amountGoToken;
                    await merchant.save({ session });

                    transactionDetails.transactionId = `SCAN_${Date.now()}_${userId}`;
                    transactionDetails.status = 'completed';
                    transactionDetails.details.recipientId = merchant._id;
                    transactionDetails.details.qrCodeData = details.qrCodeData;
                    break;

            case 'bank_transfer':
                transactionType = 'bank_transfer_send';
                sendResult = await axios.post('https://api.paystack.co/transfer', {
                    source: 'balance',
                    amount: amountFiat * 100, // Convert to kobo (smallest unit for NGN)
                    currency: fiatCurrency,
                    recipient: details.recipientCode, // Paystack recipient code
                    reason: details.paymentDescription
                }, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                    }
                });
                transactionDetails.transactionId = sendResult.data.data.transfer_code;
                transactionDetails.status = sendResult.data.data.status;
                transactionDetails.details.accountNumber = details.accountNumber;
                transactionDetails.details.bankName = details.bankName;
                transactionDetails.details.beneficiaryName = details.beneficiaryName;
                break;

            default:
                throw new AppError('Invalid send type.', 400);
        }

        const transaction = await Transaction.create([transactionDetails], { session });

        await session.commitTransaction();
        session.endSession();

        // Send notification to sender
        await notificationService.createNotification(
            userId,
            'transaction_status',
            `Your payment of ${amountGoToken} GoTokens (${amountFiat} ${fiatCurrency}) is ${transaction[0].status}. ID: ${transaction[0].transactionId}`,
            { transactionId: transaction[0]._id, type: transactionType, amountGoToken, status: transaction[0].status }
        );

        return transaction[0];
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

exports.addBeneficiary = async (userId, name, type, details) => {
    const existingBeneficiary = await Beneficiary.findOne({ userId, name, type });
    if (existingBeneficiary) {
        throw new AppError('A beneficiary with this name and type already exists.', 400);
    }

    const beneficiary = await Beneficiary.create({ userId, name, type, details });
    return beneficiary;
};

exports.getBeneficiaries = async (userId) => {
    const beneficiaries = await Beneficiary.find({ userId });
    return beneficiaries;
};

exports.createPaymentLink = async (userId, name, description, currency) => {
    // Generate a unique short code for the payment link
    let linkCode;
    let isUnique = false;
    while (!isUnique) {
        linkCode = Math.random().toString(36).substring(2, 12); // Generate a random 10-char string
        const existingLink = await PaymentLink.findOne({ linkCode });
        if (!existingLink) {
            isUnique = true;
        }
    }

    const paymentLink = await PaymentLink.create({
        userId,
        name,
        description,
        currency,
        linkCode
    });

    return paymentLink;
};

exports.getPaymentLinkDetails = async (linkCode) => {
    const paymentLink = await PaymentLink.findOne({ linkCode, isActive: true });
    if (!paymentLink) {
        throw new AppError('Payment link not found or is inactive.', 404);
    }
    return paymentLink;
};

exports.getGoTokenWalletAddress = async (userId) => {
    // For a crypto token like GoToken, a user would typically have one main address.
    // In a real system, this might be a static address generated for the user on first login,
    // or a hierarchical deterministic (HD) wallet derived address.
    // For simplicity, we'll return a deterministic address based on user ID or a mock.
    // If the app is managing on-chain wallets, this address would be persistent and unique.

    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // This is a placeholder for a real wallet address.
    // In a production setup, you'd integrate with a blockchain wallet service
    // or generate/manage real addresses.
    const mockAddress = `GT${userId.toString().slice(0, 20)}RND${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // You might store this mockAddress on the User model if it's truly static for the user
    // e.g., user.goTokenReceiveAddress
    // For now, generating on the fly for demonstration
    return mockAddress;
};

exports.saveBankDetailsForReceiving = async (userId, bankName, accountNumber, accountName) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // For simplicity, overwriting existing details. In a real app, manage multiple accounts.
    user.bankReceiveDetails = { bankName, accountNumber, accountName }; // Add this field to User model if persistent
    await user.save({ validateBeforeSave: false }); // No specific validation for this field in user model yet

    return 'Bank details saved successfully for receiving payments.';
};