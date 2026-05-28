import { Request, Response } from 'express';
import { ReportRepository } from '../repositories/ReportRepository';
import { ReportService } from '../services/ReportService';
import fs from 'fs';
import path from 'path';

export class ReportController {
  static async getReports(req: Request, res: Response) {
    try {
      const reports = ReportRepository.findAll();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const report = ReportRepository.findById(id);
      if (!report) {
        return res.status(404).json({ error: '报告不存在' });
      }
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async generateReport(req: Request, res: Response) {
    try {
      const { period } = req.body;
      const operator = req.headers['x-operator'] as string || '系统管理员';
      const currentPeriod = period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const report = ReportService.generateReport(currentPeriod, operator);
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async exportReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { format } = req.body;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      const exportFormat = (format as string) === 'xlsx' ? 'xlsx' : 'csv';
      const { fileName, filePath } = ReportService.exportReport(id, exportFormat, operator);

      if (fs.existsSync(filePath)) {
        res.download(filePath, fileName, (err) => {
          if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: '下载失败' });
          }
        });
      } else {
        res.status(404).json({ error: '导出文件不存在' });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getExportHistory(req: Request, res: Response) {
    try {
      const { reportId } = req.query;
      const history = ReportService.getExportHistory(reportId as string | undefined);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async traceExport(req: Request, res: Response) {
    try {
      const { exportId } = req.params;
      const trace = ReportService.traceVoucherFromExport(exportId);
      if (!trace) {
        return res.status(404).json({ error: '导出记录不存在' });
      }
      res.json(trace);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
