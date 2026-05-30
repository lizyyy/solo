import { Request, Response } from 'express';
import SetlistRepository from '../repositories/SetlistRepository';
import ReportService from '../services/ReportService';
import type { ApiResponse, CheckReport } from '../../shared/types';

export const ReportController = {
  generate: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const { generatedBy = 'system' } = req.body;

      const setlist = SetlistRepository.findById(setlistId);
      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const report = ReportService.generateReport(setlistId, generatedBy);
      if (!report) {
        return res.status(500).json({
          success: false,
          error: '生成报告失败',
        } as ApiResponse<null>);
      }

      res.status(201).json({
        success: true,
        data: report,
        message: `检查报告生成成功：${report.summary.passed} 通过，${report.summary.warnings} 警告，${report.summary.errors} 错误`,
      } as ApiResponse<CheckReport>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `生成报告失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  get: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const report = ReportService.getLatestReport(setlistId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: '尚未生成检查报告，请先执行校验',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: report,
      } as ApiResponse<CheckReport>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取报告失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  getById: (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const report = ReportService.getReportById(reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: '报告不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: report,
      } as ApiResponse<CheckReport>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取报告失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  history: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const reports = ReportService.getReportHistory(setlistId);

      res.json({
        success: true,
        data: reports,
      } as ApiResponse<CheckReport[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取报告历史失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  export: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const format = (req.query.format as string) || 'json';

      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: '不支持的导出格式，支持：json, csv',
        } as ApiResponse<null>);
      }

      const report = ReportService.getLatestReport(setlistId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: '尚未生成检查报告，请先执行校验',
        } as ApiResponse<null>);
      }

      const exportData = ReportService.exportReport(report, format as 'json' | 'csv');

      res.setHeader('Content-Type', exportData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.content);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `导出报告失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default ReportController;
