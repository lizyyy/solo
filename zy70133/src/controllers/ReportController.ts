import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService';
import { AuditService } from '../services/AuditService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';
import moment from 'moment';

export class ReportController {
  static async getBudgetSummary(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId } = req.params;
      const result = await ReportService.getInstance().getBudgetSummary(budgetPoolId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ReportController.handleError(error, res);
    }
  }

  static async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId, campaignId, channelId, materialId, startDate, endDate, groupBy } = req.query;

      const query: any = {
        budgetPoolId: budgetPoolId as string,
        campaignId: campaignId as string,
        channelId: channelId as string,
        materialId: materialId as string,
        groupBy: (groupBy as string) || 'DATE',
      };

      if (startDate) {
        query.startDate = moment(startDate as string).toDate();
      }
      if (endDate) {
        query.endDate = moment(endDate as string).toDate();
      }

      const result = await ReportService.getInstance().getTransactionsForReport(query);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ReportController.handleError(error, res);
    }
  }

  static async exportTransactionsToCsv(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId, campaignId, channelId, materialId, startDate, endDate, groupBy } = req.query;

      const query: any = {
        budgetPoolId: budgetPoolId as string,
        campaignId: campaignId as string,
        channelId: channelId as string,
        materialId: materialId as string,
        groupBy: (groupBy as string) || 'DATE',
      };

      if (startDate) {
        query.startDate = moment(startDate as string).toDate();
      }
      if (endDate) {
        query.endDate = moment(endDate as string).toDate();
      }

      const csv = await ReportService.getInstance().exportTransactionsToCsv(query);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      ReportController.handleError(error, res);
    }
  }

  static async exportSummaryToCsv(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId } = req.params;
      const csv = await ReportService.getInstance().exportSummaryToCsv(budgetPoolId);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="summary_${budgetPoolId}_${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      ReportController.handleError(error, res);
    }
  }

  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { resourceType, resourceId, action, startDate, endDate } = req.query;
      let logs: any[] = [];

      if (resourceType && resourceId) {
        logs = await AuditService.getInstance().getLogsByResource(
          resourceType as string,
          resourceId as string
        );
      } else if (action) {
        logs = await AuditService.getInstance().getLogsByAction(action as string);
      } else if (startDate && endDate) {
        logs = await AuditService.getInstance().getLogsByDateRange(
          moment(startDate as string).toDate(),
          moment(endDate as string).toDate()
        );
      } else {
        throw new AppException('VALIDATION_ERROR', 'Please provide either resourceType+resourceId, action, or startDate+endDate');
      }

      res.status(200).json({
        success: true,
        data: logs,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ReportController.handleError(error, res);
    }
  }

  private static handleError(error: any, res: Response): void {
    if (error instanceof AppException) {
      res.status(400).json({
        success: false,
        error: error.toJSON(),
        timestamp: new Date(),
      } as ApiResponse<any>);
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
        timestamp: new Date(),
      } as ApiResponse<any>);
    }
  }
}
