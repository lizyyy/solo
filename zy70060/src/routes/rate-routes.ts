import { Router, Request, Response } from 'express';
import { exchangeRateService } from '../services/exchange-rate-service';

export const rateRouter = Router();

rateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { currency, buyRate, sellRate } = req.body;

    if (!currency || buyRate === undefined || sellRate === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段: currency, buyRate, sellRate' 
      });
    }

    const snapshot = await exchangeRateService.createSnapshot(
      currency,
      parseFloat(buyRate),
      parseFloat(sellRate)
    );

    res.status(201).json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

rateRouter.get('/latest/:currency', async (req: Request, res: Response) => {
  try {
    const { currency } = req.params;
    const snapshot = await exchangeRateService.getLatestSnapshot(currency);

    if (!snapshot) {
      return res.status(404).json({ success: false, error: '未找到该币种的汇率快照' });
    }

    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

rateRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snapshot = await exchangeRateService.getSnapshotById(id);

    if (!snapshot) {
      return res.status(404).json({ success: false, error: '汇率快照不存在' });
    }

    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

rateRouter.get('/history/:currency', async (req: Request, res: Response) => {
  try {
    const { currency } = req.params;
    const { limit } = req.query;

    const snapshots = await exchangeRateService.getSnapshotsByCurrency(
      currency,
      limit ? parseInt(limit as string) : 10
    );

    res.json({ success: true, data: snapshots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});