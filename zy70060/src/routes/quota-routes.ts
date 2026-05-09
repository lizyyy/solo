import { Router, Request, Response } from 'express';
import { quotaLedgerService } from '../services/quota-ledger-service';
import { customerService } from '../services/customer-service';

export const quotaRouter = Router();

quotaRouter.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { year } = req.query;

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }

    const targetYear = year ? parseInt(year as string) : undefined;
    const ledger = await quotaLedgerService.getLedger(customerId, targetYear);

    if (!ledger) {
      const newLedger = await quotaLedgerService.getOrCreateLedger(customerId, targetYear);
      return res.json({ success: true, data: newLedger });
    }

    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

quotaRouter.get('/:customerId/history', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }

    const ledgers = await quotaLedgerService.getAllLedgers(customerId);

    res.json({ success: true, data: ledgers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

quotaRouter.post('/:customerId/recalculate', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { year } = req.body;

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }

    const targetYear = year || new Date().getFullYear();
    const ledger = await quotaLedgerService.recalculateQuota(customerId, targetYear);

    res.json({ 
      success: true, 
      message: '年度额度重算完成', 
      data: ledger 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});