import { Router, Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { dataStore } from '../store/dataStore';
import moment from 'moment';

const router = Router();

router.get('/excel', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, includeDetails = 'true' } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, error: '请提供计费周期参数' });
    }

    const buffer = await reportService.generateExcelReport(
      moment(periodStart as string).toDate(),
      moment(periodEnd as string).toDate(),
      includeDetails === 'true'
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=billing-report-${periodStart}-${periodEnd}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pdf', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, includeDetails = 'true' } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, error: '请提供计费周期参数' });
    }

    const buffer = await reportService.generatePDFReport(
      moment(periodStart as string).toDate(),
      moment(periodEnd as string).toDate(),
      includeDetails === 'true'
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=billing-report-${periodStart}-${periodEnd}.pdf`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records/:id/html', async (req: Request, res: Response) => {
  try {
    const record = dataStore.getBillingRecord(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, error: '账单记录不存在' });
    }

    const html = reportService.generateRecordDetailsHTML(record);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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

    const summary = dataStore.getBillingSummary(
      moment(periodStart as string).toDate(),
      moment(periodEnd as string).toDate()
    );

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
