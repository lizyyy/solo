"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCurrency = convertCurrency;
exports.convertToCNY = convertToCNY;
exports.convertBetweenCurrencies = convertBetweenCurrencies;
exports.calculateExchangeGainLoss = calculateExchangeGainLoss;
exports.getCurrencySymbol = getCurrencySymbol;
exports.formatCurrency = formatCurrency;
const validation_1 = require("./validation");
function convertCurrency(params) {
    const { amount, fromCurrency, toCurrency, exchangeRate, referenceDate } = params;
    const warnings = [];
    if (exchangeRate.fromCurrency !== fromCurrency || exchangeRate.toCurrency !== toCurrency) {
        if (exchangeRate.fromCurrency === toCurrency && exchangeRate.toCurrency === fromCurrency) {
            const inverseRate = 1 / exchangeRate.rate;
            return {
                convertedAmount: amount * inverseRate,
                rate: inverseRate,
                rateDate: exchangeRate.rateDate,
                warnings: ['使用反向汇率换算'],
                valid: true,
            };
        }
        return {
            convertedAmount: 0,
            rate: 0,
            rateDate: exchangeRate.rateDate,
            warnings: [],
            valid: false,
        };
    }
    const rateValidation = (0, validation_1.validateExchangeRateDate)(exchangeRate.rateDate, referenceDate);
    if (!rateValidation.valid) {
        warnings.push(rateValidation.message);
    }
    const dateOrderValidation = (0, validation_1.validateDateOrder)(exchangeRate.rateDate, referenceDate, '汇率日期', '贴现日期');
    if (!dateOrderValidation.valid) {
        warnings.push(dateOrderValidation.message);
    }
    const convertedAmount = amount * exchangeRate.rate;
    return {
        convertedAmount: roundTo2Decimals(convertedAmount),
        rate: exchangeRate.rate,
        rateDate: exchangeRate.rateDate,
        warnings,
        valid: warnings.length === 0,
    };
}
function convertToCNY(amount, fromCurrency, exchangeRateToCNY, referenceDate) {
    return convertCurrency({
        amount,
        fromCurrency,
        toCurrency: 'CNY',
        exchangeRate: exchangeRateToCNY,
        referenceDate,
    });
}
function convertBetweenCurrencies(amount, fromCurrency, toCurrency, rateFromToCNY, rateToToCNY, referenceDate) {
    const fromResult = convertToCNY(amount, fromCurrency, rateFromToCNY, referenceDate);
    if (!fromResult.valid && fromResult.convertedAmount === 0) {
        return {
            convertedAmount: 0,
            rate: 0,
            rateDate: rateFromToCNY.rateDate,
            warnings: fromResult.warnings,
            valid: false,
            crossRate: 0,
        };
    }
    const toResult = convertCurrency({
        amount: 1,
        fromCurrency: toCurrency,
        toCurrency: 'CNY',
        exchangeRate: rateToToCNY,
        referenceDate,
    });
    const allWarnings = [...fromResult.warnings, ...toResult.warnings];
    if (toResult.rate === 0) {
        return {
            convertedAmount: 0,
            rate: 0,
            rateDate: rateFromToCNY.rateDate,
            warnings: allWarnings,
            valid: false,
            crossRate: 0,
        };
    }
    const crossRate = fromResult.rate / toResult.rate;
    const convertedAmount = amount * crossRate;
    return {
        convertedAmount: roundTo2Decimals(convertedAmount),
        rate: crossRate,
        rateDate: rateFromToCNY.rateDate,
        warnings: allWarnings,
        valid: allWarnings.length === 0,
        crossRate,
    };
}
function calculateExchangeGainLoss(originalAmountCNY, paymentAmount, paymentCurrency, paymentRateToCNY, referenceDate) {
    const paymentResult = convertToCNY(paymentAmount, paymentCurrency, paymentRateToCNY, referenceDate);
    const gainLoss = paymentResult.convertedAmount - originalAmountCNY;
    return {
        gainLoss: roundTo2Decimals(gainLoss),
        warnings: paymentResult.warnings,
    };
}
function roundTo2Decimals(num) {
    return Math.round(num * 100) / 100;
}
function getCurrencySymbol(currency) {
    const symbols = {
        USD: '$',
        EUR: '€',
        CNY: '¥',
    };
    return symbols[currency];
}
function formatCurrency(amount, currency) {
    return `${getCurrencySymbol(currency)}${amount.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
