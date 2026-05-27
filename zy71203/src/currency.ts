import type { Currency, ExchangeRate } from './types';
import { validateExchangeRateDate, validateDateOrder } from './validation';

interface ConvertParams {
  amount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  exchangeRate: ExchangeRate;
  referenceDate: string;
}

interface ConvertResult {
  convertedAmount: number;
  rate: number;
  rateDate: string;
  warnings: string[];
  valid: boolean;
}

export function convertCurrency(params: ConvertParams): ConvertResult {
  const { amount, fromCurrency, toCurrency, exchangeRate, referenceDate } = params;
  const warnings: string[] = [];

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

  const rateValidation = validateExchangeRateDate(exchangeRate.rateDate, referenceDate);
  if (!rateValidation.valid) {
    warnings.push(rateValidation.message);
  }

  const dateOrderValidation = validateDateOrder(
    exchangeRate.rateDate,
    referenceDate,
    '汇率日期',
    '贴现日期'
  );
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

export function convertToCNY(
  amount: number,
  fromCurrency: Currency,
  exchangeRateToCNY: ExchangeRate,
  referenceDate: string
): ConvertResult {
  return convertCurrency({
    amount,
    fromCurrency,
    toCurrency: 'CNY',
    exchangeRate: exchangeRateToCNY,
    referenceDate,
  });
}

export function convertBetweenCurrencies(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rateFromToCNY: ExchangeRate,
  rateToToCNY: ExchangeRate,
  referenceDate: string
): ConvertResult & { crossRate: number } {
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

export function calculateExchangeGainLoss(
  originalAmountCNY: number,
  paymentAmount: number,
  paymentCurrency: Currency,
  paymentRateToCNY: ExchangeRate,
  referenceDate: string
): { gainLoss: number; warnings: string[] } {
  const paymentResult = convertToCNY(
    paymentAmount,
    paymentCurrency,
    paymentRateToCNY,
    referenceDate
  );

  const gainLoss = paymentResult.convertedAmount - originalAmountCNY;

  return {
    gainLoss: roundTo2Decimals(gainLoss),
    warnings: paymentResult.warnings,
  };
}

function roundTo2Decimals(num: number): number {
  return Math.round(num * 100) / 100;
}

export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    USD: '$',
    EUR: '€',
    CNY: '¥',
  };
  return symbols[currency];
}

export function formatCurrency(amount: number, currency: Currency): string {
  return `${getCurrencySymbol(currency)}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
