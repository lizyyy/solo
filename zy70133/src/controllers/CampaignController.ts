import { Request, Response } from 'express';
import { CampaignService } from '../services/CampaignService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';

export class CampaignController {
  static async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { budgetPoolId, name, description, totalBudget, startDate, endDate } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await CampaignService.getInstance().createCampaign(
        { budgetPoolId, name, description, totalBudget, startDate, endDate },
        operator
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await CampaignService.getInstance().getCampaign(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async getAllCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const result = await CampaignService.getInstance().getAllCampaigns();

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async activateCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string;

      const result = await CampaignService.getInstance().activateCampaign(id, operator);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async pauseCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await CampaignService.getInstance().pauseCampaign(id, operator, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async resumeCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string;

      const result = await CampaignService.getInstance().resumeCampaign(id, operator);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
    }
  }

  static async completeCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await CampaignService.getInstance().completeCampaign(id, operator, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      CampaignController.handleError(error, res);
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
