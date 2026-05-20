import { Router, Request, Response } from 'express';
import { billingCalculatorService } from '../services/billingCalculatorService';
import { dataStore } from '../store/dataStore';
import moment from 'moment';

const router = Router();

router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, error: '请提供计费周期参数' });
    }

    const start = moment(periodStart).toDate();
    const end = moment(periodEnd).toDate();

    const records = await billingCalculatorService.calculateBillingForPeriod(start, end);
    const summary = billingCalculatorService.getBillingSummary(start, end);

    res.json({
      success: true,
      recordsGenerated: records.length,
      records,
      summary
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, tenantId, status, page = '1', pageSize = '20' } = req.query;

    let records = dataStore.getAllBillingRecords();

    if (periodStart && periodEnd) {
      const start = moment(periodStart as string).toDate();
      const end = moment(periodEnd as string).toDate();
      records = records.filter(r => r.periodStart >= start && r.periodEnd <= end);
    }

    if (tenantId) {
      records = records.filter(r => r.tenantId === tenantId);
    }

    if (status) {
      records = records.filter(r => r.reviewStatus === status);
    }

    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const total = records.length;
    const paginated = records.slice((pageNum - 1) * size, pageNum * size);

    res.json({
      success: true,
      data: {
        records: paginated,
        total,
        page: pageNum,
        pageSize: size
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records/:id', async (req: Request, res: Response) => {
  try {
    const record = dataStore.getBillingRecord(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const updated = await billingCalculatorService.recalculateRecord(req.params.id);

    if (!updated) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, error: '请提供计费周期参数' });
    }

    const summary = billingCalculatorService.getBillingSummary(
      moment(periodStart as string).toDate(),
      moment(periodEnd as string).toDate()
    );

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
