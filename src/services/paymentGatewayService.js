const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
if (!paystackSecretKey) {
    throw new Error('Paystack secret key is not configured in environment variables.');
}

exports.processBankTransfer = async (userId, amountFiat, fiatCurrency, accountNumber, bankName, paymentDescription) => {
    try {
        console.log('[PaymentGatewayService] Starting bank transfer process at', new Date().toISOString(), ':', {
            userId,
            amountFiat: Number(amountFiat), // Ensure it's a number
            fiatCurrency,
            accountNumber,
            bankName,
            paymentDescription
        });

        // Validate inputs
        if (!accountNumber || !/^\d{10,13}$/.test(accountNumber)) {
            throw new Error('Invalid account number. Must be 10-13 digits.');
        }
        if (!bankName) {
            throw new Error('Bank name is required.');
        }
        if (!amountFiat || isNaN(Number(amountFiat))) {
            throw new Error('Invalid amount. Must be a valid number.');
        }

        let transferAmount = Number(amountFiat);
        let currency = fiatCurrency || 'USD';
        
        console.log('[PaymentGatewayService] Initial currency and amount:', { currency, transferAmount });

        // Convert to NGN if not already NGN
        if (currency !== 'NGN') {
            const ngnRate = await getExchangeRateToNgn(currency);
            transferAmount = transferAmount * ngnRate;
            currency = 'NGN';
            console.log('[PaymentGatewayService] Converted to NGN:', { ngnRate, transferAmount, currency });
        }

        // Generate transfer reference
        const transferReference = uuidv4();
        console.log('[PaymentGatewayService] Generated transfer reference:', transferReference);

        // Get or create recipient
        const recipientCode = await getOrCreateRecipient(accountNumber, bankName);
        console.log('[PaymentGatewayService] Obtained recipient code:', recipientCode);

        // Prepare transfer payload
        const payload = {
            source: 'balance',
            reason: paymentDescription || 'Withdrawal from GoCoin',
            amount: Math.round(transferAmount * 100), // Convert to kobo (smallest unit)
            reference: transferReference,
            recipient: recipientCode,
            currency: currency
        };
        console.log('[PaymentGatewayService] Paystack transfer payload:', payload);

        // Make transfer request
        const response = await axios.post('https://api.paystack.co/transfer', payload, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[PaymentGatewayService] Paystack API response:', response.data);

        if (response.data.status) {
            const result = {
                transactionId: response.data.data.transfer_code,
                amount: transferAmount,
                currency: currency,
                status: response.data.data.status,
                recipient: accountNumber,
                reference: transferReference
            };
            console.log('[PaymentGatewayService] Transfer successful:', result);
            return result;
        } else {
            console.log('[PaymentGatewayService] Paystack transfer failed:', response.data);
            throw new Error('Paystack transfer initiation failed: ' + (response.data.message || 'Unknown reason'));
        }
    } catch (error) {
        console.error('[PaymentGatewayService] Error processing bank transfer at', new Date().toISOString(), ':', {
            message: error.message,
            stack: error.stack,
            response: error.response ? error.response.data : 'No response data',
            requestPayload: error.config ? error.config.data : 'No request data'
        });
        
        if (error.response) {
            console.error('[PaymentGatewayService] Paystack API Error Details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        
        throw new Error('Failed to process bank transfer. Please check your details or try again later.');
    }
};

// Helper function to get or create a recipient
async function getOrCreateRecipient(accountNumber, bankName) {
    try {
        console.log('[PaymentGatewayService] Attempting to get or create recipient at', new Date().toISOString(), ':', { 
            accountNumber, 
            bankName 
        });
        
        const bankCode = await getPaystackBankCode(bankName);
        console.log('[PaymentGatewayService] Resolved bank code:', { bankName, bankCode });

        // First, try to resolve account name to ensure account is valid
        try {
            const resolveResponse = await axios.get(
                `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
                {
                    headers: {
                        Authorization: `Bearer ${paystackSecretKey}`
                    }
                }
            );
            
            if (!resolveResponse.data.status) {
                throw new Error('Invalid account details: ' + resolveResponse.data.message);
            }
            
            const accountName = resolveResponse.data.data.account_name;
            console.log('[PaymentGatewayService] Account resolved successfully:', { accountName });
        } catch (resolveError) {
            console.error('[PaymentGatewayService] Account resolution failed:', resolveError.response?.data || resolveError.message);
            throw new Error('Invalid account number or bank. Please verify your details.');
        }

        // Check if recipient already exists
        try {
            const listRecipientsResponse = await axios.get('https://api.paystack.co/transferrecipient', {
                headers: {
                    Authorization: `Bearer ${paystackSecretKey}`
                }
            });

            if (listRecipientsResponse.data.status && listRecipientsResponse.data.data) {
                const existingRecipient = listRecipientsResponse.data.data.find(recipient => 
                    recipient.details.account_number === accountNumber && 
                    recipient.details.bank_code === bankCode
                );

                if (existingRecipient) {
                    console.log('[PaymentGatewayService] Existing recipient found:', existingRecipient);
                    return existingRecipient.recipient_code;
                }
            }
        } catch (listError) {
            console.log('[PaymentGatewayService] Could not list existing recipients, proceeding to create new one');
        }

        // Create new recipient
        const createPayload = {
            type: 'nuban', // Nigerian Uniform Bank Account Number
            name: `User_${accountNumber.slice(-4)}`, // Use last 4 digits for name
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN'
        };
        console.log('[PaymentGatewayService] Creating new recipient with payload:', createPayload);

        const createResponse = await axios.post('https://api.paystack.co/transferrecipient', createPayload, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[PaymentGatewayService] Recipient creation response:', createResponse.data);

        if (!createResponse.data.status) {
            throw new Error('Failed to create recipient: ' + createResponse.data.message);
        }

        return createResponse.data.data.recipient_code;
    } catch (error) {
        console.error('[PaymentGatewayService] Error getting/creating recipient at', new Date().toISOString(), ':', {
            message: error.message,
            stack: error.stack,
            response: error.response ? error.response.data : 'No response data'
        });
        throw new Error('Failed to set up recipient for transfer: ' + error.message);
    }
}

// Helper function to get Paystack bank code
async function getPaystackBankCode(bankName) {
    try {
        // First try to get the bank code from Paystack's bank list API
        const banksResponse = await axios.get('https://api.paystack.co/bank', {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`
            }
        });

        if (banksResponse.data.status && banksResponse.data.data) {
            const bank = banksResponse.data.data.find(b => 
                b.name.toLowerCase().includes(bankName.toLowerCase()) ||
                bankName.toLowerCase().includes(b.name.toLowerCase())
            );
            
            if (bank) {
                console.log('[PaymentGatewayService] Found bank code from API:', { bankName, code: bank.code, fullName: bank.name });
                return bank.code;
            }
        }
    } catch (error) {
        console.log('[PaymentGatewayService] Could not fetch bank list from API, using fallback mapping');
    }

    // Fallback to static mapping
    const bankCodes = {
        'Access Bank': '044',
        'Access Bank Plc': '044',
        'Citibank Nigeria': '023',
        'Diamond Bank': '063',
        'Ecobank Nigeria': '050',
        'Enterprise Bank': '084',
        'Fidelity Bank': '070',
        'First Bank of Nigeria': '011',
        'First City Monument Bank': '214',
        'Guaranty Trust Bank': '058',
        'Heritage Bank': '030',
        'Keystone Bank': '082',
        'Mainstreet Bank': '014',
        'Skye Bank': '076',
        'Stanbic IBTC Bank': '221',
        'Standard Chartered Bank': '068',
        'Sterling Bank': '232',
        'Union Bank of Nigeria': '032',
        'United Bank For Africa': '033',
        'Unity Bank': '215',
        'Wema Bank': '035',
        'Zenith Bank': '057'
    };

    // Try exact match first
    let code = bankCodes[bankName];
    
    // If no exact match, try partial match
    if (!code) {
        const bankKey = Object.keys(bankCodes).find(key => 
            key.toLowerCase().includes(bankName.toLowerCase()) ||
            bankName.toLowerCase().includes(key.toLowerCase())
        );
        code = bankKey ? bankCodes[bankKey] : null;
    }

    if (!code) {
        throw new Error(`Bank code not found for: ${bankName}. Please use the exact bank name as registered with Paystack.`);
    }

    console.log('[PaymentGatewayService] Mapped bank code for', bankName, ':', code);
    return code;
}

// Helper function to get exchange rate
async function getExchangeRateToNgn(currency) {
    // You should replace this with a real exchange rate API
    const rates = {
        'USD': 1600, // Approximate USD to NGN rate
        'EUR': 1750, // Approximate EUR to NGN rate
        'GBP': 2000, // Approximate GBP to NGN rate
    };
    
    const rate = rates[currency.toUpperCase()];
    if (!rate) {
        throw new Error(`Exchange rate not available for currency: ${currency}`);
    }
    
    console.log('[PaymentGatewayService] Using exchange rate:', { currency, rate });
    return rate;
}


exports.processMobileMoneyTransfer = async (userId, amountFiat, fiatCurrency, mobileNumber, network, paymentDescription, name) => {
    try {
        console.log('[PaymentGatewayService] Starting mobile money transfer process at', new Date().toISOString(), ':', {
            userId,
            amountFiat,
            fiatCurrency,
            mobileNumber,
            network,
            paymentDescription,
            name
        });

        // Validate inputs
        if (!mobileNumber || !/^\+\d{9,14}$/.test(mobileNumber)) {
            throw new Error('Invalid mobile number. Must be in international format (e.g., +233XXXXXXXXX).');
        }
        if (!network || typeof network !== 'string') {
            throw new Error('Invalid network. Must be a non-empty string.');
        }
        if (isNaN(amountFiat) || amountFiat <= 0) {
            throw new Error('Invalid amountFiat. Must be a positive number.');
        }
        if (!fiatCurrency || typeof fiatCurrency !== 'string') {
            throw new Error('Invalid fiatCurrency. Must be a non-empty string.');
        }
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid name. Must be a non-empty string.');
        }

        let transferAmount = parseFloat(amountFiat);
        let currency = fiatCurrency.toUpperCase();
        console.log('[PaymentGatewayService] Initial currency and amount:', { currency, transferAmount });

        // Convert to supported mobile money currency (GHS for Ghana, KES for Kenya)
        let targetCurrency = currency;
        if (currency !== 'GHS' && currency !== 'KES') {
            const conversionRate = await getExchangeRateToMobileCurrency(currency);
            transferAmount = transferAmount * conversionRate;
            targetCurrency = network === 'M-Pesa' ? 'KES' : 'GHS'; // Default to GHS for MTN, KES for M-Pesa
            console.log('[PaymentGatewayService] Converted to mobile currency:', { conversionRate, transferAmount, targetCurrency });
        }

        const transferReference = uuidv4();
        console.log('[PaymentGatewayService] Generated transfer reference:', transferReference);

        const recipientCode = await getOrCreateMobileMoneyRecipient(mobileNumber, network, name);
        console.log('[PaymentGatewayService] Obtained recipient code:', recipientCode);

        const payload = {
            source: 'balance',
            reason: paymentDescription || 'Mobile money withdrawal',
            amount: Math.round(transferAmount * 100), // Convert to smallest unit (e.g., pesewas for GHS, cents for KES)
            reference: transferReference,
            recipient: recipientCode,
            currency: targetCurrency
        };
        console.log('[PaymentGatewayService] Paystack mobile money transfer payload:', payload);

        const response = await axios.post('https://api.paystack.co/transfer', payload, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[PaymentGatewayService] Paystack API response:', response.data);

        if (response.data.status) {
            const result = {
                transactionId: response.data.data.transfer_code,
                amount: transferAmount,
                currency: targetCurrency,
                status: response.data.data.status,
                recipient: mobileNumber,
                reference: transferReference
            };
            console.log('[PaymentGatewayService] Mobile money transfer successful:', result);
            return result;
        } else {
            console.log('[PaymentGatewayService] Paystack mobile money transfer failed:', response.data);
            throw new Error('Paystack mobile money transfer initiation failed: ' + (response.data.message || 'Unknown reason'));
        }
    } catch (error) {
        console.error('[PaymentGatewayService] Error processing mobile money transfer at', new Date().toISOString(), ':', {
            message: error.message,
            stack: error.stack,
            response: error.response ? error.response.data : 'No response data',
            requestPayload: error.config ? error.config.data : 'No request data'
        });
        if (error.response) {
            console.error('[PaymentGatewayService] Paystack API Error Details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw new Error('Failed to process mobile money transfer. Please check your details or try again later.');
    }
};

// Helper function to get or create a mobile money recipient
async function getOrCreateMobileMoneyRecipient(mobileNumber, network, name) {
    try {
        console.log('[PaymentGatewayService] Attempting to get or create mobile money recipient at', new Date().toISOString(), ':', { mobileNumber, network, name });
        const bankCode = await getNetworkCode(network); // Map network to Paystack code
        console.log('[PaymentGatewayService] Resolved network code:', { network, bankCode });

        // Check if recipient exists
        const recipientResponse = await axios.get(`https://api.paystack.co/transfer/recipient?account_number=${mobileNumber.replace('+', '')}&bank_code=${bankCode}`, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`
            }
        });
        console.log('[PaymentGatewayService] Mobile money recipient lookup response:', recipientResponse.data);

        if (recipientResponse.data.data && recipientResponse.data.data.length > 0) {
            console.log('[PaymentGatewayService] Existing mobile money recipient found:', recipientResponse.data.data[0]);
            return recipientResponse.data.data[0].recipient_code;
        }

        // Create new mobile money recipient
        const createPayload = {
            type: 'mobile_money',
            name: name,
            account_number: mobileNumber.replace('+', ''), // Remove + for Paystack
            bank_code: bankCode,
            currency: network === 'M-Pesa' ? 'KES' : 'GHS' // KES for M-Pesa, GHS for MTN
        };
        console.log('[PaymentGatewayService] Creating new mobile money recipient with payload:', createPayload);

        const createResponse = await axios.post('https://api.paystack.co/transferrecipient', createPayload, {
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[PaymentGatewayService] Mobile money recipient creation response:', createResponse.data);

        return createResponse.data.data.recipient_code;
    } catch (error) {
        console.error('[PaymentGatewayService] Error getting/creating mobile money recipient at', new Date().toISOString(), ':', {
            message: error.message,
            stack: error.stack,
            response: error.response ? error.response.data : 'No response data',
            requestPayload: error.config ? error.config.data : 'No request data'
        });
        throw new Error('Failed to set up mobile money recipient for transfer.');
    }
}

// Helper functions
async function getNetworkCode(network) {
    const networkCodes = {
        'MTN': 'MTN',    // Example code for MTN Mobile Money (Ghana)
        'Vodafone': 'VOD', // Example code for Vodafone (Ghana)
        'AirtelTigo': 'AT', // Example code for AirtelTigo (Ghana)
        'M-Pesa': 'MPESA' // Example code for M-Pesa (Kenya)
        // Add more mappings as per Paystack documentation or API
    };
    const code = networkCodes[network] || 'MTN'; // Default to MTN if not found
    console.log('[PaymentGatewayService] Mapped network code for', network, ':', code);
    return code;
}

async function getExchangeRateToMobileCurrency(currency) {
    if (currency === 'USD') {
        return 1600; // Approx USD to GHS rate as of July 2025 (adjust for KES if needed)
    }
    return 1; // Default to 1 if currency is GHS or KES
}