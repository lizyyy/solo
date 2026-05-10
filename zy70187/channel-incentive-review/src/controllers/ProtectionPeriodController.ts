import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { protectionPeriodService, CreateProtectionPeriodRequest } from '../services/ProtectionPeriodService';
import { dataStore } from '../repositories/DataStore';

export const ProtectionPeriodController = {
  async createProtection(req: AuthenticatedRequest, res: Response) {
    try {
      const result = protectionPeriodService.createProtectionPeriod(
        req.body as CreateProtectionPeriodRequest,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async approveProtection(req: AuthenticatedRequest, res: Response) {
    try {
      const { protectionId } = req.params;
      const result = protectionPeriodService.approveProtectionPeriod(
        protectionId,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async terminateProtection(req: AuthenticatedRequest, res: Response) {
    try {
      const { protectionId } = req.params;
      const { reason } = req.body;
      
      const result = protectionPeriodService.terminateProtectionPeriod(
        protectionId,
        reason,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getProtection(req: AuthenticatedRequest, res: Response) {
    try {
      const { protectionId } = req.params;
      const protection = protectionPeriodService.getProtectionById(protectionId);

      if (!protection) {
        return res.status(404).json({
          success: false,
          errorMessage: '保护期记录不存在'
        });
      }

      res.json({
        success: true,
        protection
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async listProtections(req: AuthenticatedRequest, res: Response) {
    try {
      const protections = dataStore.protectionPeriods.findAll();
      res.json({
        success: true,
        data: protections
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
