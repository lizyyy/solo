import express, { Request, Response, Router } from 'express';
import {
  generateReportData,
  generateSummaryHtml,
  generateExcelReport,
  generateCsvReport,
} from '../services/reportService';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reportData = await generateReportData(req.params.id);
    res.json(reportData);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/html', async (req: Request, res: Response) => {
  try {
    const reportData = await generateReportData(req.params.id);
    const html = generateSummaryHtml(reportData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.id}.html"`);
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/excel', async (req: Request, res: Response) => {
  try {
    const reportData = await generateReportData(req.params.id);
    const excelBuffer = generateExcelReport(reportData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.id}.xlsx"`);
    res.send(excelBuffer);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/csv', async (req: Request, res: Response) => {
  try {
    const reportData = await generateReportData(req.params.id);
    const csv = generateCsvReport(reportData);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
