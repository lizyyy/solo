import { Request, Response } from 'express';
import { reportService, CreateReportDto } from '../services/reportService';
import { handleError } from '../utils/errorHandler';

export const reportController = {
  async getAllReports(req: Request, res: Response) {
    try {
      const reports = await reportService.getAllReports();
      res.json({ success: true, data: reports });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getReportById(req: Request, res: Response) {
    try {
      const report = await reportService.getReportById(req.params.id);
      res.json({ success: true, data: report });
    } catch (error) {
      handleError(res, error);
    }
  },

  async createReport(req: Request, res: Response) {
    try {
      const data: CreateReportDto = req.body;
      const report = await reportService.createReport(data);
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      handleError(res, error);
    }
  },

  async approveReport(req: Request, res: Response) {
    try {
      const { approver } = req.body;
      const report = await reportService.approveReport(req.params.id, approver);
      res.json({ success: true, data: report });
    } catch (error) {
      handleError(res, error);
    }
  },

  async exportReports(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'json' | 'excel') || 'json';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      const result = await reportService.exportReports(format, startDate, endDate);
      
      if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="reports-${Date.now()}.xlsx"`);
        res.send(result);
      } else {
        res.json({ success: true, data: result });
      }
    } catch (error) {
      handleError(res, error);
    }
  }
};
