import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { targetSnapshotService, CreateTargetSnapshotRequest } from '../services/TargetSnapshotService';
import { dataStore } from '../repositories/DataStore';
import { auditLogger } from '../utils/AuditLogger';

export const TargetSnapshotController = {
  async createSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const result = targetSnapshotService.createSnapshot(
        req.body as CreateTargetSnapshotRequest,
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

  async finalizeSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { snapshotId } = req.params;
      const result = targetSnapshotService.finalizeSnapshot(snapshotId, req.operator!);

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

  async getSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { snapshotId } = req.params;
      const snapshot = targetSnapshotService.getSnapshotById(snapshotId);

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          errorMessage: '目标快照不存在'
        });
      }

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getSnapshotByChannel(req: AuthenticatedRequest, res: Response) {
    try {
      const { channelId, year, quarter } = req.params;
      const snapshot = targetSnapshotService.getSnapshot(
        channelId,
        parseInt(year),
        quarter as any
      );

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          errorMessage: '未找到目标快照'
        });
      }

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async listSnapshots(req: AuthenticatedRequest, res: Response) {
    try {
      const snapshots = dataStore.targetSnapshots.findAll();
      res.json({
        success: true,
        data: snapshots
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
