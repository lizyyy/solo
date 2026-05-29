import { Router, Request, Response } from 'express';
import type { Currency } from '../../shared/types.js';
import { convertCurrency, getExchangeRates, updateExchangeRate } from '../services/currencyService.js';

const router = Router();

router.get('/convert', async (req: Request, res: Response) => {
  try {
    const { amount, from, to } = req.query;

    if (!amount || !from) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: amount and from',
      });
    }

    const result = await convertCurrency(
      parseFloat(amount as string),
      from as Currency,
      (to as Currency) || 'CNY'
    );

    res.json({
      success: true,
      data: {
        originalAmount: parseFloat(amount as string),
        originalCurrency: from,
        convertedAmount: result,
        targetCurrency: to || 'CNY',
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.get('/rates', async (_req: Request, res: Response) => {
  try {
    const rates = await getExchangeRates();

    res.json({
      success: true,
      data: rates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.patch('/rates/:currency', async (req: Request, res: Response) => {
  try {
    const { currency } = req.params;
    const { rate } = req.body;

    const rates = await updateExchangeRate(currency as Currency, rate);

    res.json({
      success: true,
      data: rates,
      message: '汇率更新成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

export default router;
