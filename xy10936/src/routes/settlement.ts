import { Router, Request, Response } from 'express';
import * as settlementService from '../services/settlementService';
import * as settlementDao from '../dao/settlementDao';
import * as exportService from '../services/exportService';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { customer_id, start_date, end_date, generated_by } = req.body;
    if (!customer_id || !start_date || !end_date) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const result = await settlementService.generateSettlementReport(
      customer_id,
      start_date,
      end_date,
      generated_by || 'system'
    );
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    await settlementService.confirmSettlement(reportId);
    res.json({ success: true, message: '结算确认成功' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.query;
    if (customer_id) {
      const reports = await settlementDao.getSettlementReportsByCustomer(parseInt(customer_id as string));
      return res.json(reports);
    }
    const reports = await settlementDao.getAllSettlementReports();
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const result = await settlementService.getReportWithDetails(reportId);
    res.json(result);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const csv = await exportService.exportSettlementReportToCSV(reportId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=settlement-report-${reportId}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/weighing', async (req: Request, res: Response) => {
  try {
    const { customer_id, status } = req.query;
    const csv = await exportService.exportWeighingRecordsToCSV(
      customer_id ? parseInt(customer_id as string) : undefined,
      status as string | undefined
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=weighing-records.csv');
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
