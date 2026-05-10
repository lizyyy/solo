import { Request, Response } from 'express';
import { ResourceService } from '../services/ResourceService';
import { AppException } from '../exceptions/AppException';
import { ApiResponse } from '../types';

export class ResourceController {
  static async createMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, type, metadata } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await ResourceService.getInstance().createMaterial(
        { name, description, type, metadata },
        operator
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async getMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ResourceService.getInstance().getMaterial(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async getAllMaterials(req: Request, res: Response): Promise<void> {
    try {
      const result = await ResourceService.getInstance().getAllMaterials();

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async approveMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string;

      const result = await ResourceService.getInstance().approveMaterial(id, operator);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async rejectMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await ResourceService.getInstance().rejectMaterial(id, operator, reason);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async createChannel(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, type, feeRate, rules } = req.body;
      const operator = req.headers['x-operator'] as string;

      const result = await ResourceService.getInstance().createChannel(
        { name, description, type, feeRate, rules },
        operator
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async getChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ResourceService.getInstance().getChannel(id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
    }
  }

  static async getAllChannels(req: Request, res: Response): Promise<void> {
    try {
      const result = await ResourceService.getInstance().getAllChannels();

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date(),
      } as ApiResponse<any>);
    } catch (error) {
      ResourceController.handleError(error, res);
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
