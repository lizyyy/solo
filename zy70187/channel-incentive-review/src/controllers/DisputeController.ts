import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { disputeService, RaiseDisputeRequest } from '../services/DisputeService';
import { dataStore } from '../repositories/DataStore';

export const DisputeController = {
  async raiseDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const result = disputeService.raiseDispute(
        req.body as RaiseDisputeRequest,
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

  async assignDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const { assigneeId } = req.body;
      
      const result = disputeService.assignDispute(
        disputeId,
        assigneeId,
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

  async startReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const result = disputeService.startReview(disputeId, req.operator!);

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

  async requestEvidence(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const { requestMessage } = req.body;
      
      const result = disputeService.requestEvidence(
        disputeId,
        requestMessage,
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

  async submitEvidence(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const result = disputeService.submitEvidence(
        disputeId,
        req.body,
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

  async resolveDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const result = disputeService.resolveDispute(
        disputeId,
        req.body,
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

  async addComment(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const { comment, isInternal } = req.body;
      
      const result = disputeService.addComment(
        disputeId,
        comment,
        isInternal,
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

  async getDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const { disputeId } = req.params;
      const dispute = disputeService.getDisputeById(disputeId);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          errorMessage: '争议记录不存在'
        });
      }

      res.json({
        success: true,
        dispute
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async listDisputes(req: AuthenticatedRequest, res: Response) {
    try {
      const { achievementRecordId, status } = req.query;
      let disputes;
      
      if (achievementRecordId) {
        disputes = disputeService.getDisputesByAchievement(achievementRecordId as string);
      } else if (status === 'open') {
        disputes = disputeService.getOpenDisputes();
      } else {
        disputes = dataStore.disputes.findAll();
      }

      res.json({
        success: true,
        data: disputes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
