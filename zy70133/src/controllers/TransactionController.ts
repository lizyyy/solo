import { Request, Response } from 'express';
import { TransactionService } from '../services/TransactionService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';

export class TransactionController {
  static async deduct(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId, campaignId, materialId, channelId, amount, reason, metadata } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await TransactionService.getInstance().deduct({
        budgetPoolId,
        campaignId,
        materialId,
        channelId,
        amount,
        reason,
        operator,
        metadata,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async refund(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, amount, reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await TransactionService.getInstance().refund({
        transactionId,
        amount,
        reason,
        operator,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async compensate(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, budgetPoolId, campaignId, amount, reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await TransactionService.getInstance().compensate({
        transactionId,
        budgetPoolId,
        campaignId,
        amount,
        reason,
        operator,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async revert(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await TransactionService.getInstance().revert({
        transactionId,
        reason,
        operator,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await TransactionService.getInstance().getTransaction(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async getTransactionsByBudgetPool(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId } = req.params;
      const result = await TransactionService.getInstance().getTransactionsByBudgetPool(budgetPoolId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async getTransactionsByCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;
      const result = await TransactionService.getInstance().getTransactionsByCampaign(campaignId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
    }
  }

  static async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await TransactionService.getInstance().getTransactionHistory(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      TransactionController.handleError(error, res);
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
