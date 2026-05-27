import { Request, Response } from 'express';
import { reportService } from '../services/reportService';
import dayjs from 'dayjs';

export const getDetailedReport = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const report = reportService.generateDetailedReport(orderNo);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSummaryReport = (_req: Request, res: Response) => {
  try {
    const report = reportService.generateSummaryReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportDetailedToExcel = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const buffer = reportService.exportToExcel(orderNo);
    const filename = `对账详情_${orderNo}_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportSummaryToExcel = (_req: Request, res: Response) => {
  try {
    const buffer = reportService.exportSummaryToExcel();
    const filename = `对账汇总_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeductionEvidence = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const evidence = reportService.generateDeductionEvidence(orderNo);
    res.json(evidence);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
