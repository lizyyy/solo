import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';

export class ReportController {
  static async generateBatchReport(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const processedBy = req.headers['x-user'] as string || 'system';

      const report = await ReportService.generateBatchReport(batchId, processedBy);
      const formattedReport = ReportService.formatReport(report);

      res.json({ 
        success: true, 
        data: report,
        formatted: formattedReport
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const report = ReportService.getReportById(id);
      
      if (!report) {
        return res.status(404).json({ success: false, error: '报告不存在' });
      }

      const formattedReport = ReportService.formatReport(report);

      res.json({ success: true, data: report, formatted: formattedReport });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getReportsByBatch(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const reports = ReportService.getReportsByBatchId(batchId);
      res.json({ success: true, data: reports });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getAllReports(req: Request, res: Response) {
    try {
      const reports = ReportService.getAllReports();
      res.json({ success: true, data: reports });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
