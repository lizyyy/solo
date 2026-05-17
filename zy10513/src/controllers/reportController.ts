import { Request, Response } from 'express';
import fs from 'fs';
import { ReportService } from '../services/ReportService';

const reportService = new ReportService();

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { generatedBy } = req.body;
    const report = await reportService.generateReport(batchId, generatedBy);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await reportService.getReportById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: '报告不存在' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const downloadReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await reportService.getReportById(reportId);
    if (!report || !report.filePath) {
      return res.status(404).json({ success: false, message: '报告文件不存在' });
    }

    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({ success: false, message: '报告文件不存在' });
    }

    res.download(report.filePath, `${report.reportNo}.xlsx`);
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const listReports = async (req: Request, res: Response) => {
  try {
    const { batchId, page, pageSize } = req.query;
    const result = await reportService.listReports({
      batchId: batchId as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
