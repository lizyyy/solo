import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { achievementService, CreateAchievementRecordRequest } from '../services/AchievementService';
import { dataStore } from '../repositories/DataStore';
import { auditLogger } from '../utils/AuditLogger';

export const AchievementController = {
  async createRecord(req: AuthenticatedRequest, res: Response) {
    try {
      const result = achievementService.createAchievementRecord(
        req.body as CreateAchievementRecordRequest,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      const status = result.needsManualReview ? 202 : 201;
      res.status(status).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getRecord(req: AuthenticatedRequest, res: Response) {
    try {
      const { recordId } = req.params;
      const record = achievementService.getRecordById(recordId);

      if (!record) {
        return res.status(404).json({
          success: false,
          errorMessage: '达标记录不存在'
        });
      }

      res.json({
        success: true,
        record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getRecordHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { recordId } = req.params;
      const history = achievementService.getRecordHistory(recordId);

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

  async listRecords(req: AuthenticatedRequest, res: Response) {
    try {
      const { channelId } = req.query;
      let records;
      
      if (channelId) {
        records = achievementService.getRecordsByChannel(channelId as string);
      } else {
        records = dataStore.achievementRecords.findAll();
      }

      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
