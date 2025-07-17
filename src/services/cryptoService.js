// src/utils/cryptoPriceService.js
const config = require('../config/config');
const AppError = require('./AppError');

// This is a mock service. In production, you would integrate with a real-time crypto price API
// like CoinGecko, CoinMarketCap, or an exchange API.
exports.getExchangeRate = async (fromCurrency, toCurrency) => {
    // Mock exchange rates
    const rates = {
        'GoToken_USD': config.goTokenConversionRateUSD,
        'USD_GoToken': 1 / config.goTokenConversionRateUSD,
        'GoToken_BTC': 0.000000001, // Example mock rate
        'BTC_GoToken': 1 / 0.000000001,
        'GoToken_ETH': 0.00000001, // Example mock rate
        'ETH_GoToken': 1 / 0.00000001,
        'USD_NGN': 1200, // Example mock rate for fiat conversion
        'NGN_USD': 1 / 1200
    };

    const rateKey = `${fromCurrency}_${toCurrency}`;
    if (rates[rateKey]) {
        return rates[rateKey];
    } else {
        // Fallback for direct fiat conversion if GoToken is involved
        if (fromCurrency === 'GoToken' && toCurrency.toUpperCase() === config.defaultFiatCurrency.toUpperCase()) {
            return config.goTokenConversionRateUSD;
        }
        if (fromCurrency.toUpperCase() === config.defaultFiatCurrency.toUpperCase() && toCurrency === 'GoToken') {
            return 1 / config.goTokenConversionRateUSD;
        }
        throw new AppError(`No exchange rate found for ${fromCurrency} to ${toCurrency}.`, 400);
    }
};

exports.convertGoTokenToFiat = async (goTokenAmount, targetFiatCurrency = config.defaultFiatCurrency) => {
    // In a real app, fetch real-time rate
    const rate = await exports.getExchangeRate('GoToken', targetFiatCurrency.toUpperCase());
    return goTokenAmount * rate;
};

exports.convertFiatToGoToken = async (fiatAmount, sourceFiatCurrency = config.defaultFiatCurrency) => {
    // In a real app, fetch real-time rate
    const rate = await exports.getExchangeRate(sourceFiatCurrency.toUpperCase(), 'GoToken');
    return fiatAmount * rate;
};