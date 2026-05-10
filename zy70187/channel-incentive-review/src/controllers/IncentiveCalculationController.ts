import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { incentiveCalculationService, CalculateIncentiveRequest } from '../services/IncentiveCalculationService';
import { dataStore } from '../repositories/DataStore';

export const IncentiveCalculationController = {
  async calculateIncentive(req: AuthenticatedRequest, res: Response) {
    try {
      const result = incentiveCalculationService.calculateIncentive(
        req.body as CalculateIncentiveRequest,
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

  async approveIncentive(req: AuthenticatedRequest, res: Response) {
    try {
      const { incentiveId } = req.params;
      const result = incentiveCalculationService.approveIncentive(
        incentiveId,
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

  async schedulePayout(req: AuthenticatedRequest, res: Response) {
    try {
      const { incentiveId } = req.params;
      const { scheduledDate } = req.body;
      
      const result = incentiveCalculationService.schedulePayout(
        incentiveId,
        new Date(scheduledDate),
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

  async markAsPaid(req: AuthenticatedRequest, res: Response) {
    try {
      const { incentiveId } = req.params;
      const { paymentReference } = req.body;
      
      const result = incentiveCalculationService.markAsPaid(
        incentiveId,
        paymentReference,
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

  async getIncentive(req: AuthenticatedRequest, res: Response) {
    try {
      const { incentiveId } = req.params;
      const incentive = incentiveCalculationService.getIncentiveById(incentiveId);

      if (!incentive) {
        return res.status(404).json({
          success: false,
          errorMessage: '激励明细不存在'
        });
      }

      res.json({
        success: true,
        incentive
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getIncentiveHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { incentiveId } = req.params;
      const history = incentiveCalculationService.getIncentiveHistory(incentiveId);

      res.json({
        success: true,
        history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async listIncentives(req: AuthenticatedRequest, res: Response) {
    try {
      const { channelId } = req.query;
      let incentives;
      
      if (channelId) {
        incentives = incentiveCalculationService.getIncentivesByChannel(channelId as string);
      } else {
        incentives = dataStore.incentiveDetails.findAll();
      }

      res.json({
        success: true,
        data: incentives
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
