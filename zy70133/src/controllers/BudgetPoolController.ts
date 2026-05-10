import { Request, Response } from 'express';
import { BudgetPoolService } from '../services/BudgetPoolService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';

export class BudgetPoolController {
  static async createBudgetPool(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, totalAmount, startDate, endDate, dailyLimit, rules } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await BudgetPoolService.getInstance().createBudgetPool(
        { name, description, totalAmount, startDate, endDate, dailyLimit, rules },
        operator
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
    }
  }

  static async getBudgetPool(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await BudgetPoolService.getInstance().getBudgetPool(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
    }
  }

  static async getAllBudgetPools(req: Request, res: Response): Promise<void> {
    try {
      const result = await BudgetPoolService.getInstance().getAllBudgetPools();

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
    }
  }

  static async getAvailableAmount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const available = await BudgetPoolService.getInstance().getAvailableAmount(id);

      res.status(200).json({
        success: true,
        data: { available },
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const operator = req.headers['x-operator'] as string;

      if (!['PAUSED', 'ACTIVE', 'ARCHIVED'].includes(status)) {
        throw new Error('Invalid status');
      }

      const result = await BudgetPoolService.getInstance().updateStatus(
        id,
        status as 'PAUSED' | 'ACTIVE' | 'ARCHIVED',
        operator
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
    }
  }

  static async addBudget(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await BudgetPoolService.getInstance().addBudget(
        id,
        amount,
        operator,
        reason
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      BudgetPoolController.handleError(error, res);
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
