"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDiscount = calculateDiscount;
exports.calculatePartialDiscount = calculatePartialDiscount;
exports.generateProfitReport = generateProfitReport;
exports.getNextValidStatus = getNextValidStatus;
exports.validateStatusTransition = validateStatusTransition;
const currency_1 = require("./currency");
const uuid_1 = require("uuid");
function calculateDiscount(params) {
    const { invoiceAmount, invoiceCurrency, discountRate, discountDays, exchangeRateToCNY, interestCurrency, referenceDate, } = params;
    const conversionResult = (0, currency_1.convertToCNY)(invoiceAmount, invoiceCurrency, exchangeRateToCNY, referenceDate);
    const invoiceAmountCNY = conversionResult.convertedAmount;
    const warnings = [...conversionResult.warnings];
    const dailyRate = discountRate / 100 / 360;
    const dailyInterestCNY = invoiceAmountCNY * dailyRate;
    const totalInterestCNY = dailyInterestCNY * discountDays;
    const netProceedsCNY = invoiceAmountCNY - totalInterestCNY;
    const effectiveAnnualRate = (totalInterestCNY / netProceedsCNY) * (360 / discountDays) * 100;
    let totalInterest = totalInterestCNY;
    let finalInterestCurrency = interestCurrency;
    if (interestCurrency !== 'CNY') {
        const cnyRate = {
            fromCurrency: 'CNY',
            toCurrency: interestCurrency,
            rate: 1 / exchangeRateToCNY.rate,
            rateDate: exchangeRateToCNY.rateDate,
            source: exchangeRateToCNY.source,
        };
        const interestResult = (0, currency_1.convertToCNY)(totalInterestCNY, 'CNY', cnyRate, referenceDate);
        if (interestResult.rate > 0) {
            totalInterest = totalInterestCNY * interestResult.rate;
            warnings.push(...interestResult.warnings);
        }
        else {
            warnings.push(`无法将利息转换为${interestCurrency}，使用CNY显示`);
            finalInterestCurrency = 'CNY';
        }
    }
    return {
        invoiceAmountCNY: roundTo2Decimals(invoiceAmountCNY),
        discountInterestCNY: roundTo2Decimals(totalInterestCNY),
        netProceedsCNY: roundTo2Decimals(netProceedsCNY),
        dailyInterestCNY: roundTo2Decimals(dailyInterestCNY),
        totalInterest: roundTo2Decimals(totalInterest),
        interestCurrency: finalInterestCurrency,
        effectiveAnnualRate: roundTo2Decimals(effectiveAnnualRate),
        warnings,
    };
}
function calculatePartialDiscount(invoice, partialAmount, partialRate, referenceDate) {
    const warnings = [];
    if (partialAmount > invoice.remainingUndiscountedAmount) {
        warnings.push(`部分贴现金额(${partialAmount})超过剩余未贴现金额(${invoice.remainingUndiscountedAmount})`);
    }
    if (partialAmount <= 0) {
        warnings.push('部分贴现金额必须大于0');
    }
    const dailyRate = partialRate / 100 / 360;
    const interestAmount = partialAmount * dailyRate * invoice.discountDays;
    let interestCurrency = invoice.invoiceCurrency;
    let interestInInvoiceCurrency = interestAmount;
    if (invoice.exchangeRateToCNY) {
        const conversionResult = (0, currency_1.convertBetweenCurrencies)(interestAmount, 'CNY', invoice.invoiceCurrency, invoice.exchangeRateToCNY, invoice.exchangeRateToCNY, referenceDate);
        interestInInvoiceCurrency = conversionResult.convertedAmount;
        warnings.push(...conversionResult.warnings);
    }
    const partialDetail = {
        id: (0, uuid_1.v4)(),
        discountAmount: partialAmount,
        discountDate: new Date().toISOString().split('T')[0],
        discountRate: partialRate,
        interestAmount: roundTo2Decimals(interestInInvoiceCurrency),
        interestCurrency,
    };
    const newTotalDiscounted = invoice.totalDiscountedAmount + partialAmount;
    const newRemaining = invoice.invoiceAmount - newTotalDiscounted;
    const updatedInvoice = {
        ...invoice,
        partialDiscountDetails: [...invoice.partialDiscountDetails, partialDetail],
        totalDiscountedAmount: roundTo2Decimals(newTotalDiscounted),
        remainingUndiscountedAmount: roundTo2Decimals(Math.max(0, newRemaining)),
        updatedAt: new Date().toISOString(),
    };
    return { partialDetail, updatedInvoice, warnings };
}
function generateProfitReport(invoice, payments, bankFeesCNY = 0) {
    const warnings = [];
    let totalPaymentReceivedCNY = 0;
    if (!invoice.exchangeRateToCNY) {
        warnings.push('缺少发票币种兑人民币汇率，无法计算收益报告');
    }
    if (!invoice.exchangeRatePaymentToCNY && payments.some(p => p.currency !== 'CNY')) {
        warnings.push('缺少回款币种兑人民币汇率，部分回款无法换算');
    }
    const invoiceAmountCNY = invoice.exchangeRateToCNY
        ? (0, currency_1.convertToCNY)(invoice.invoiceAmount, invoice.invoiceCurrency, invoice.exchangeRateToCNY, invoice.discountDate).convertedAmount
        : 0;
    for (const payment of payments) {
        if (payment.currency === 'CNY') {
            totalPaymentReceivedCNY += payment.amount;
        }
        else if (invoice.exchangeRatePaymentToCNY) {
            const result = (0, currency_1.convertToCNY)(payment.amount, payment.currency, invoice.exchangeRatePaymentToCNY, payment.date);
            totalPaymentReceivedCNY += result.convertedAmount;
            warnings.push(...result.warnings);
        }
    }
    const totalDiscountInterestCNY = invoice.partialDiscountDetails.reduce((sum, detail) => {
        if (detail.interestCurrency === 'CNY') {
            return sum + detail.interestAmount;
        }
        else if (invoice.exchangeRateToCNY) {
            const result = (0, currency_1.convertToCNY)(detail.interestAmount, detail.interestCurrency, invoice.exchangeRateToCNY, detail.discountDate);
            return sum + result.convertedAmount;
        }
        return sum;
    }, 0);
    const exchangeGainLossCNY = totalPaymentReceivedCNY - invoiceAmountCNY;
    const netProfitCNY = totalPaymentReceivedCNY -
        invoiceAmountCNY -
        totalDiscountInterestCNY -
        bankFeesCNY +
        exchangeGainLossCNY;
    const report = {
        id: (0, uuid_1.v4)(),
        invoiceDiscountId: invoice.id,
        reportDate: new Date().toISOString().split('T')[0],
        invoiceAmountCNY: roundTo2Decimals(invoiceAmountCNY),
        totalPaymentReceivedCNY: roundTo2Decimals(totalPaymentReceivedCNY),
        totalDiscountInterestCNY: roundTo2Decimals(totalDiscountInterestCNY),
        bankFeesCNY: roundTo2Decimals(bankFeesCNY),
        exchangeGainLossCNY: roundTo2Decimals(exchangeGainLossCNY),
        netProfitCNY: roundTo2Decimals(netProfitCNY),
    };
    return { report, warnings };
}
function roundTo2Decimals(num) {
    return Math.round(num * 100) / 100;
}
function getNextValidStatus(currentStatus) {
    const transitions = {
        DRAFT: ['PENDING_APPROVAL'],
        PENDING_APPROVAL: ['DRAFT', 'APPROVED'],
        APPROVED: ['DISCOUNTED', 'PARTIALLY_SETTLED'],
        DISCOUNTED: ['PARTIALLY_SETTLED', 'FULLY_SETTLED'],
        PARTIALLY_SETTLED: ['FULLY_SETTLED', 'COMPLETED'],
        FULLY_SETTLED: ['COMPLETED'],
        COMPLETED: [],
    };
    return transitions[currentStatus] || [];
}
function validateStatusTransition(currentStatus, targetStatus) {
    const validTransitions = getNextValidStatus(currentStatus);
    if (!validTransitions.includes(targetStatus)) {
        return {
            valid: false,
            message: `无法从${currentStatus}状态转换到${targetStatus}状态，允许的转换为: ${validTransitions.join(', ') || '无'}`,
        };
    }
    return { valid: true, message: '' };
}
