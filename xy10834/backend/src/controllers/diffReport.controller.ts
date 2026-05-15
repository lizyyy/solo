import { Request, Response, NextFunction } from 'express';
import diffReportService from '../services/diffReport.service';
import fs from 'fs';

export async function generateDiffReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await diffReportService.generateReport(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDiffReports(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await diffReportService.findAll({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      configId: req.query.configId as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDiffReport(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await diffReportService.findById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function exportReportToCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = await diffReportService.exportToCSV(req.params.id);
    res.download(filePath, (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function exportEffectiveStatesToCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = await diffReportService.exportEffectiveStatesCSV(req.params.configId);
    res.download(filePath, (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
}
