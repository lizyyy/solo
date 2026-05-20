import { Request, Response } from 'express';
import * as path from 'path';
import { dataStore } from '../models/store';
import { reconciliationService } from '../services/ReconciliationService';
import { importService } from '../services/ImportService';
import { reportService } from '../services/ReportService';
import { ReviewResult } from '../models/types';

class ReconciliationController {
  async createReconciliation(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId } = req.body;
      
      if (!applicationId) {
        res.status(400).json({ error: '申请ID不能为空' });
        return;
      }

      const record = await reconciliationService.createReconciliation(applicationId);
      
      if (!record) {
        res.status(404).json({ error: '未找到对应的摊位申请' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async batchCreateReconciliations(req: Request, res: Response): Promise<void> {
    try {
      const records = await reconciliationService.batchCreateAll();
      res.json({ 
        success: true, 
        count: records.length,
        data: records 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getReconciliation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const record = dataStore.getReconciliationRecord(id);
      
      if (!record) {
        res.status(404).json({ error: '未找到对账记录' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getAllReconciliations(req: Request, res: Response): Promise<void> {
    try {
      const records = dataStore.getAllReconciliationRecords();
      res.json({ success: true, count: records.length, data: records });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async reviewDiscrepancy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        discrepancyId, 
        reviewer, 
        result, 
        notes, 
        adjustmentAmount, 
        adjustmentReason 
      } = req.body;

      if (!discrepancyId || !reviewer || !result || !notes) {
        res.status(400).json({ error: '缺少必要参数' });
        return;
      }

      const record = await reconciliationService.reviewDiscrepancy(
        id,
        discrepancyId,
        reviewer,
        result as ReviewResult,
        notes,
        adjustmentAmount,
        adjustmentReason
      );

      if (!record) {
        res.status(404).json({ error: '未找到对账记录或差异记录' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async completeReconciliation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reviewer } = req.body;

      if (!reviewer) {
        res.status(400).json({ error: '复核人不能为空' });
        return;
      }

      const record = await reconciliationService.completeReconciliation(id, reviewer);

      if (!record) {
        res.status(404).json({ error: '未找到对账记录' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = reconciliationService.getSummary();
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async importApplications(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: '请提供文件路径' });
        return;
      }

      const result = await importService.importBoothApplications(filePath);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async importLicenses(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: '请提供文件路径' });
        return;
      }

      const result = await importService.importLicenseAttachments(filePath);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async importVenueCalendar(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: '请提供文件路径' });
        return;
      }

      const result = await importService.importVenueCalendar(filePath);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async exportReconciliationCSV(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const record = dataStore.getReconciliationRecord(id);

      if (!record) {
        res.status(404).json({ error: '未找到对账记录' });
        return;
      }

      const filePath = reportService.generateReconciliationCSV(record);
      const fileName = path.basename(filePath);

      res.download(filePath, fileName);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async exportReconciliationPDF(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const record = dataStore.getReconciliationRecord(id);

      if (!record) {
        res.status(404).json({ error: '未找到对账记录' });
        return;
      }

      const filePath = await reportService.generateReconciliationPDF(record);
      const fileName = path.basename(filePath);

      res.download(filePath, fileName);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async exportSummaryCSV(req: Request, res: Response): Promise<void> {
    try {
      const records = dataStore.getAllReconciliationRecords();
      const filePath = reportService.generateDetailedCSV(records);
      const fileName = path.basename(filePath);

      res.download(filePath, fileName);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async exportSummaryPDF(req: Request, res: Response): Promise<void> {
    try {
      const summary = reconciliationService.getSummary();
      const filePath = await reportService.generateSummaryPDF(summary);
      const fileName = path.basename(filePath);

      res.download(filePath, fileName);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getAllApplications(req: Request, res: Response): Promise<void> {
    try {
      const applications = dataStore.getAllBoothApplications();
      res.json({ success: true, count: applications.length, data: applications });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getAllLicenses(req: Request, res: Response): Promise<void> {
    try {
      const licenses = dataStore.getAllLicenseAttachments();
      res.json({ success: true, count: licenses.length, data: licenses });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getVenueCalendar(req: Request, res: Response): Promise<void> {
    try {
      const calendars = dataStore.getAllVenueCalendars();
      res.json({ success: true, count: calendars.length, data: calendars });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const reconciliationController = new ReconciliationController();
