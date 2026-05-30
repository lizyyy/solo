import type { Request, Response } from 'express';
import type { ReportRequest } from '../../../shared/types.js';
import { reportService } from '../services/ReportService.js';
import fs from 'fs';

const DEFAULT_OPERATOR = 'system';

export class ReportController {
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as ReportRequest;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;

      if (!request.customerIds || request.customerIds.length === 0) {
        res.status(400).json({
          success: false,
          error: '请选择要导出报告的客户'
        });
        return;
      }

      if (!['excel', 'pdf'].includes(request.format)) {
        res.status(400).json({
          success: false,
          error: '仅支持Excel和PDF格式'
        });
        return;
      }

      const result = await reportService.generateReport(request, operator);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '生成报告失败'
      });
    }
  }

  downloadReport(req: Request, res: Response): void {
    try {
      const { reportId } = req.params;
      const filePath = reportService.getReportFilePath(reportId);

      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          error: '报告文件不存在或已过期'
        });
        return;
      }

      const fileName = filePath.split('/').pop() || `report_${reportId}`;
      const fileExt = fileName.split('.').pop() || 'xlsx';
      const contentType = fileExt === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Download report error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '下载报告失败'
      });
    }
  }

  getBatchTask(req: Request, res: Response): void {
    try {
      const { taskId } = req.params;
      const task = reportService.getBatchTask(taskId);
      
      if (!task) {
        res.status(404).json({
          success: false,
          error: '任务不存在'
        });
        return;
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Get batch task error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取任务状态失败'
      });
    }
  }
}

export const reportController = new ReportController();
