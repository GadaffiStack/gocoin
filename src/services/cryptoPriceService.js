const axios = require('axios');

// /**
//  * Fetches the exchange rate between two cryptocurrencies using CryptoCompare API.
//  * @param {string} fromCurrency - The currency to convert from (e.g., BTC).
//  * @param {string} toCurrency - The currency to convert to (e.g., USDT).
//  * @returns {Promise<number>} - The exchange rate.
//  */
// exports.getExchangeRate = async (fromCurrency, toCurrency) => {
//     try {
//         const [fromRes, toRes] = await Promise.all([
//             axios.get(`https://rest.coincap.io/v3/rates/${fromCurrency.toLowerCase()}`, {
//                 params: {
//                     apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
//                 }
//             }),
//             axios.get(`https://rest.coincap.io/v3/rates/${toCurrency.toLowerCase()}`, {
//                 params: {
//                     apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
//                 }
//             })
//         ]);

//         // Log the API responses for debugging
//         console.log('[CryptoPriceService] API Response for fromCurrency:', fromRes.data);
//         console.log('[CryptoPriceService] API Response for toCurrency:', toRes.data);

//         const fromRate = parseFloat(fromRes.data.data?.rateUsd);
//         const toRate = parseFloat(toRes.data.data?.rateUsd);

//         if (!fromRate || !toRate) {
//             throw new Error(`Rates not found for ${fromCurrency} or ${toCurrency}`);
//         }

//         const rate = fromRate / toRate;
//         return rate;
//     } catch (error) {
//         console.error('[CryptoPriceService] Error fetching exchange rate:', error.message);
//         if (error.response) {
//             console.error('[CryptoPriceService] API Error Response:', error.response.data);
//         }
//         throw new Error('Failed to fetch exchange rate. Please try again later.');
//     }
// };



const currencyMap = {
    BTC: 'bitcoin',
    USDT: 'tether'
    // Add more mappings as needed
};

const goTokenRateUsd = 1.0; 

exports.getExchangeRate = async (fromCurrency, toCurrency) => {
    try {

        if (fromCurrency === 'GoToken' || toCurrency === 'GoToken') {
            if (fromCurrency === 'GoToken' && toCurrency === 'GoToken') {
                return 1.0; // Same currency, rate is 1
            }

            const otherCurrency = fromCurrency === 'GoToken' ? toCurrency : fromCurrency;
            const otherSlug = currencyMap[otherCurrency.toUpperCase()];

            if (!otherSlug) {
                throw new Error(`Unsupported currency: ${otherCurrency}`);
            }

            const otherRes = await axios.get(`https://rest.coincap.io/v3/rates/${otherSlug}`, {
                  params: {
                    apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
                }
            });

         

            console.log('[CryptoPriceService] API Response for otherCurrency:', otherRes.data);

            const otherRateUsd = parseFloat(otherRes.data.data?.rateUsd);
            if (!otherRateUsd) {
                throw new Error(`Rate not found for ${otherCurrency}`);
            }

            // Calculate rate relative to GoToken's internal rate
            const rate = fromCurrency === 'GoToken' 
                ? otherRateUsd / goTokenRateUsd 
                : goTokenRateUsd / otherRateUsd;
            return rate;
        }

        const fromSlug = currencyMap[fromCurrency.toUpperCase()];
        const toSlug = currencyMap[toCurrency.toUpperCase()];

        if (!fromSlug || !toSlug) {
            throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
        }

        const [fromRes, toRes] = await Promise.all([
            axios.get(`https://rest.coincap.io/v3/rates/${fromSlug}`, {
                params: {
                    apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
                }
            }),
            axios.get(`https://rest.coincap.io/v3/rates/${toSlug}`, {
                params: {
                    apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
                }
            })
        ]);

        console.log('[CryptoPriceService] Full API Response for fromCurrency:', fromRes.data);
        console.log('[CryptoPriceService] Full API Response for toCurrency:', toRes.data);

        const fromRate = fromRes.data.data?.rateUsd ? parseFloat(fromRes.data.data.rateUsd) : null;
        const toRate = toRes.data.data?.rateUsd ? parseFloat(toRes.data.data.rateUsd) : null;

        if (!fromRate || !toRate) {
            throw new Error(`Rates not found or null for ${fromCurrency} or ${toCurrency}. Response: from=${JSON.stringify(fromRes.data)}, to=${JSON.stringify(toRes.data)}`);
        }

        const rate = fromRate / toRate;
        return rate;
    } catch (error) {
        console.error('[CryptoPriceService] Error fetching exchange rate:', error.message);
        if (error.response) {
            console.error('[CryptoPriceService] API Error Response:', error.response.data);
        }
        throw new Error('Failed to fetch exchange rate. Please try again later.');
    }
};



exports.convertGoTokenToFiat = async (goTokenAmount, fiatCurrency = 'USD') => {
    try {
        if (goTokenAmount === 0) return 0;

        let fiatRate = 1.0; // Default to 1 if fiatCurrency is USD
        if (fiatCurrency !== 'USD') {
            const fiatSlug = fiatCurrency.toLowerCase(); // Adjust based on API requirements
            const fiatRes = await axios.get(`https://rest.coincap.io/v3/rates/${fiatSlug}`, {
                  params: {
                    apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
                }
        });
        
            fiatRate = parseFloat(fiatRes.data.data?.rateUsd) || 1.0;
            if (!fiatRate) {
                throw new Error(`Rate not found for ${fiatCurrency}`);
            }
        }

        // Convert GoToken to USD and then to the requested fiat currency
        const usdValue = goTokenAmount * goTokenRateUsd;
        const fiatValue = usdValue / fiatRate;
        return fiatValue;
    } catch (error) {
        console.error('[CryptoPriceService] Error converting GoToken to Fiat:', error.message);
        if (error.response) {
            console.error('[CryptoPriceService] API Error Response:', error.response.data);
        }
        throw new Error('Failed to convert GoToken to fiat. Please try again later.');
    }
};




exports.convertFiatToGoToken = async (amountFiat, fiatCurrency = 'USD') => {
    try {
        if (amountFiat === 0) return 0;

        let fiatRate = 1.0; // Default to 1 if fiatCurrency is USD
        if (fiatCurrency !== 'USD') {
            const fiatSlug = fiatCurrency.toLowerCase(); // Adjust based on API requirements
            const fiatRes = await axios.get(`https://rest.coincap.io/v3/rates/${fiatSlug}`, {
                 params: {
                    apiKey: "2897ec445b10a294cd9458a03c5077ec1d5758da05f11d5ec02246a18c78594f"
                }
        });
            fiatRate = parseFloat(fiatRes.data.data?.rateUsd) || 1.0;
            if (!fiatRate) {
                throw new Error(`Rate not found for ${fiatCurrency}`);
            }
        }

        // Convert fiat to USD and then to GoToken
        const usdValue = amountFiat * fiatRate;
        const goTokenAmount = usdValue / goTokenRateUsd;
        return goTokenAmount;
    } catch (error) {
        console.error('[CryptoPriceService] Error converting Fiat to GoToken:', error.message);
        if (error.response) {
            console.error('[CryptoPriceService] API Error Response:', error.response.data);
        }
        throw new Error('Failed to convert fiat to GoToken. Please try again later.');
    }
};