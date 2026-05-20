import { Request, Response } from 'express';
import { ReconciliationEngine } from '../services/ReconciliationEngine';
import { reviewService } from '../services/ReviewService';
import { store } from '../models/Store';

export class ReconciliationController {
  async runReconciliation(req: Request, res: Response) {
    try {
      const { periodStart, periodEnd } = req.body;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          message: '请提供对账周期开始和结束时间'
        });
      }

      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      const engine = new ReconciliationEngine(startDate, endDate);
      const { discrepancies, summary } = await engine.runFullReconciliation();

      const report = await reviewService.recalculateReconciliation(startDate, endDate, true);

      res.json({
        success: true,
        data: {
          summary,
          discrepancies: discrepancies.slice(0, 100),
          totalDiscrepancies: discrepancies.length,
          reportId: report.report?.id
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '对账失败',
        error: error.message
      });
    }
  }

  async getDiscrepancies(req: Request, res: Response) {
    try {
      const { status, type, page = 1, limit = 50 } = req.query;

      let discrepancies = store.getAllDiscrepancies();

      if (status) {
        discrepancies = discrepancies.filter(d => d.status === status);
      }

      if (type) {
        discrepancies = discrepancies.filter(d => d.type === type);
      }

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginated = discrepancies.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          discrepancies: paginated,
          total: discrepancies.length,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(discrepancies.length / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取差异列表失败',
        error: error.message
      });
    }
  }

  async getDiscrepancy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const discrepancy = store.getDiscrepancy(id);

      if (!discrepancy) {
        return res.status(404).json({
          success: false,
          message: '差异记录不存在'
        });
      }

      const reviews = reviewService.getReviewsByDiscrepancy(id);

      res.json({
        success: true,
        data: {
          discrepancy,
          reviews
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取差异详情失败',
        error: error.message
      });
    }
  }

  async reviewDiscrepancy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { action, reviewer, comments, adjustments } = req.body;

      if (!action || !reviewer) {
        return res.status(400).json({
          success: false,
          message: '请提供审核操作和审核人'
        });
      }

      const result = await reviewService.reviewDiscrepancy(
        id,
        action,
        reviewer,
        comments || '',
        adjustments
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '审核失败',
        error: error.message
      });
    }
  }

  async recalculate(req: Request, res: Response) {
    try {
      const { periodStart, periodEnd } = req.body;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          message: '请提供对账周期开始和结束时间'
        });
      }

      const result = await reviewService.recalculateReconciliation(
        new Date(periodStart),
        new Date(periodEnd),
        true
      );

      res.json({
        success: true,
        data: {
          summary: result.summary,
          newDiscrepanciesCount: result.newDiscrepancies.length,
          reportId: result.report?.id
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '重新计算失败',
        error: error.message
      });
    }
  }

  async getReports(req: Request, res: Response) {
    try {
      const reports = store.getAllReconciliations();
      
      res.json({
        success: true,
        data: {
          reports: reports.map(r => ({
            id: r.id,
            reconciliationId: r.reconciliationId,
            period: r.period,
            status: r.status,
            summary: r.summary,
            generatedAt: r.generatedAt,
            finalizedAt: r.finalizedAt
          }))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取报告列表失败',
        error: error.message
      });
    }
  }

  async getReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const summary = reviewService.getReportSummary(id);

      res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取报告详情失败',
        error: error.message
      });
    }
  }

  async finalizeReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { finalizedBy } = req.body;

      if (!finalizedBy) {
        return res.status(400).json({
          success: false,
          message: '请提供结报人'
        });
      }

      const report = await reviewService.finalizeReport(id, finalizedBy);

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '结报失败',
        error: error.message
      });
    }
  }
}

export const reconciliationController = new ReconciliationController();
