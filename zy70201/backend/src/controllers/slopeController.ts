import { Request, Response } from 'express';
import { slopeService, CreateSlopeDto, UpdateSlopeDto } from '../services/slopeService';
import { handleError } from '../utils/errorHandler';

export const slopeController = {
  async getAllSlopes(req: Request, res: Response) {
    try {
      const slopes = await slopeService.getAllSlopes();
      res.json({ success: true, data: slopes });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getSlopeById(req: Request, res: Response) {
    try {
      const slope = await slopeService.getSlopeById(req.params.id);
      res.json({ success: true, data: slope });
    } catch (error) {
      handleError(res, error);
    }
  },

  async createSlope(req: Request, res: Response) {
    try {
      const data: CreateSlopeDto = req.body;
      const slope = await slopeService.createSlope(data);
      res.status(201).json({ success: true, data: slope });
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateSlope(req: Request, res: Response) {
    try {
      const data: UpdateSlopeDto = req.body;
      const slope = await slopeService.updateSlope(req.params.id, data);
      res.json({ success: true, data: slope });
    } catch (error) {
      handleError(res, error);
    }
  },

  async deleteSlope(req: Request, res: Response) {
    try {
      await slopeService.deleteSlope(req.params.id);
      res.json({ success: true, message: '雪道删除成功' });
    } catch (error) {
      handleError(res, error);
    }
  },

  async getSlopesNeedingGrooming(req: Request, res: Response) {
    try {
      const slopes = await slopeService.getSlopesNeedingGrooming();
      res.json({ success: true, data: slopes });
    } catch (error) {
      handleError(res, error);
    }
  }
};
