import { Request, Response } from 'express';
import { vehicleService, CreateVehicleDto, UpdateVehicleDto } from '../services/vehicleService';
import { handleError } from '../utils/errorHandler';

export const vehicleController = {
  async getAllVehicles(req: Request, res: Response) {
    try {
      const vehicles = await vehicleService.getAllVehicles();
      res.json({ success: true, data: vehicles });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getVehicleById(req: Request, res: Response) {
    try {
      const vehicle = await vehicleService.getVehicleById(req.params.id);
      res.json({ success: true, data: vehicle });
    } catch (error) {
      handleError(res, error);
    }
  },

  async createVehicle(req: Request, res: Response) {
    try {
      const data: CreateVehicleDto = req.body;
      const vehicle = await vehicleService.createVehicle(data);
      res.status(201).json({ success: true, data: vehicle });
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateVehicle(req: Request, res: Response) {
    try {
      const data: UpdateVehicleDto = req.body;
      const vehicle = await vehicleService.updateVehicle(req.params.id, data);
      res.json({ success: true, data: vehicle });
    } catch (error) {
      handleError(res, error);
    }
  },

  async deleteVehicle(req: Request, res: Response) {
    try {
      await vehicleService.deleteVehicle(req.params.id);
      res.json({ success: true, message: '车辆删除成功' });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getAvailableVehicles(req: Request, res: Response) {
    try {
      const vehicles = await vehicleService.getAvailableVehicles();
      res.json({ success: true, data: vehicles });
    } catch (error) {
      handleError(res, error);
    }
  },

  async reportBreakdown(req: Request, res: Response) {
    try {
      const result = await vehicleService.handleVehicleBreakdown(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  }
};
