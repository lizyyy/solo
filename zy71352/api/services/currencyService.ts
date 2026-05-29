import type { Currency } from '../../shared/types.js';
import { getDb } from '../db/index.js';

export const convertCurrency = async (
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency = 'CNY'
): Promise<number> => {
  const db = await getDb();
  const rates = db.data.exchangeRates;

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Unsupported currency: ${fromCurrency} -> ${toCurrency}`);
  }

  const amountInBase = amount * fromRate;
  const converted = amountInBase / toRate;

  return Math.round(converted * 100) / 100;
};

export const getExchangeRates = async () => {
  const db = await getDb();
  return db.data.exchangeRates;
};

export const updateExchangeRate = async (currency: Currency, rate: number) => {
  const db = await getDb();
  db.data.exchangeRates[currency] = rate;
  await db.write();
  return db.data.exchangeRates;
};
