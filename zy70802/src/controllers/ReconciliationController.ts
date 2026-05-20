import { Request, Response } from 'express';
import { ImportService } from '../services/ImportService';
import { ReconciliationEngine } from '../services/ReconciliationEngine';
import { ReviewService } from '../services/ReviewService';
import { ReportService } from '../services/ReportService';
import { DataStore } from '../store/DataStore';

export class ReconciliationController {
  private importService: ImportService;
  private engine: ReconciliationEngine;
  private reviewService: ReviewService;
  private reportService: ReportService;
  private dataStore: DataStore;

  constructor() {
    this.importService = new ImportService();
    this.engine = new ReconciliationEngine();
    this.reviewService = new ReviewService();
    this.reportService = new ReportService();
    this.dataStore = DataStore.getInstance();
  }

  async importCriticalValues(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const result = await this.importService.importCriticalValuesFromCSVBuffer(req.file.buffer);

      res.json({
        success: true,
        message: `成功导入 ${result.importedCount} 条危急值记录`,
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async importCallbacks(req: Request, res: Response) {
    try {
      const jsonData = req.body;
      const result = await this.importService.importCallbacksFromJSONString(JSON.stringify(jsonData));

      res.json({
        success: true,
        message: `成功导入 ${result.importedCount} 条电话回告记录`,
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async importDutySchedules(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const result = await this.importService.importDutySchedulesFromCSVBuffer(req.file.buffer);

      res.json({
        success: true,
        message: `成功导入 ${result.importedCount} 条值班表记录`,
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async runReconciliation(req: Request, res: Response) {
    try {
      const results = await this.engine.runReconciliation();
      const summary = this.engine.getSummary();

      res.json({
        success: true,
        message: `对账完成，共处理 ${results.length} 条记录`,
        summary,
        results,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async getReconciliationResults(req: Request, res: Response) {
    try {
      const { status, department } = req.query;
      let results = this.dataStore.getAllReconciliations();

      if (status) {
        results = results.filter(r => r.status === status);
      }

      const resultsWithDetails = results.map(r => {
        const cv = this.dataStore.getCriticalValue(r.criticalValueId);
        const cb = r.callbackId ? this.dataStore.getCallback(r.callbackId) : undefined;

        if (department && cv && cv.department !== department) {
          return null;
        }

        return {
          reconciliation: r,
          criticalValue: cv,
          callback: cb,
        };
      }).filter(Boolean);

      const summary = this.engine.getSummary();

      res.json({
        success: true,
        summary,
        results: resultsWithDetails,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async getReconciliationDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const detail = this.reportService.generateDetailedReport(id);

      res.json({
        success: true,
        data: detail,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async reviewAndConfirm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reviewer, notes } = req.body;

      if (!reviewer) {
        return res.status(400).json({ error: '请提供复核人姓名' });
      }

      const result = await this.reviewService.reviewAndConfirm(id, reviewer, notes);

      res.json({
        success: true,
        message: '复核完成',
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async modifyCallback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { updates, reviewer, notes } = req.body;

      if (!reviewer) {
        return res.status(400).json({ error: '请提供修改人姓名' });
      }

      const processedUpdates = { ...updates };
      if (processedUpdates.confirmedAt && typeof processedUpdates.confirmedAt === 'string') {
        processedUpdates.confirmedAt = new Date(processedUpdates.confirmedAt);
      }

      const result = await this.reviewService.modifyCallback(id, processedUpdates, reviewer, notes);

      res.json({
        success: true,
        message: '修改完成，已重新对账',
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async dismissDiscrepancy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { discrepancyType, reviewer, reason } = req.body;

      if (!reviewer || !reason) {
        return res.status(400).json({ error: '请提供复核人姓名和忽略原因' });
      }

      const result = await this.reviewService.dismissDiscrepancy(id, discrepancyType, reviewer, reason);

      res.json({
        success: true,
        message: '已忽略该差异类型',
        data: result,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async getSummaryReport(req: Request, res: Response) {
    try {
      const report = this.reportService.generateSummaryReport();

      res.json({
        success: true,
        data: report,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async exportReconciliationCSV(req: Request, res: Response) {
    try {
      const csv = this.reportService.generateReconciliationReportCSV();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reconciliation_report_${Date.now()}.csv"`);
      res.send('\ufeff' + csv);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async exportDiscrepancyCSV(req: Request, res: Response) {
    try {
      const csv = this.reportService.generateDiscrepancyReportCSV();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="discrepancy_report_${Date.now()}.csv"`);
      res.send('\ufeff' + csv);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async getReviewHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = this.reviewService.getReviewHistory(id);

      res.json({
        success: true,
        data: history,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async clearAllData(req: Request, res: Response) {
    try {
      this.dataStore.clearAll();

      res.json({
        success: true,
        message: '所有数据已清空',
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
}
