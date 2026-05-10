import { Request, Response } from 'express';
import { MaterialBindingService } from '../services/MaterialBindingService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';

export class MaterialBindingController {
  static async bindMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { materialId, campaignId, channelId, allocatedBudget, priority, startDate, endDate } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await MaterialBindingService.getInstance().bindMaterial(
        { materialId, campaignId, channelId, allocatedBudget, priority, startDate, endDate },
        operator
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async getBinding(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await MaterialBindingService.getInstance().getBinding(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async getBindingsByCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;
      const result = await MaterialBindingService.getInstance().getBindingsByCampaign(campaignId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async getActiveBindings(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId, channelId } = req.params;
      const result = await MaterialBindingService.getInstance().getActiveBindings(campaignId, channelId);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async unbindMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await MaterialBindingService.getInstance().unbindMaterial(id, operator, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async pauseBinding(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await MaterialBindingService.getInstance().pauseBinding(id, operator, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async resumeBinding(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string;

      const result = await MaterialBindingService.getInstance().resumeBinding(id, operator);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
    }
  }

  static async updateAllocatedBudget(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newAllocation } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await MaterialBindingService.getInstance().updateAllocatedBudget(
        id,
        newAllocation,
        operator
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      MaterialBindingController.handleError(error, res);
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
