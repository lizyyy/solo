import { Router, Request, Response } from 'express';
import { SnapshotService } from '../services/snapshotService';

export function createSnapshotRouter(snapshotService: SnapshotService): Router {
  const router = Router();

  router.post('/:groupCreditId', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.params;
      const { snapshotTime } = req.body;
      
      const snapshotDate = snapshotTime ? new Date(snapshotTime) : undefined;
      const snapshot = await snapshotService.createSnapshot(groupCreditId, snapshotDate);

      res.status(201).json({
        success: true,
        data: snapshot
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建快照失败'
      });
    }
  });

  router.get('/:snapshotId', async (req: Request, res: Response) => {
    try {
      const { snapshotId } = req.params;
      const snapshot = await snapshotService.getSnapshotById(snapshotId);
      res.json({
        success: true,
        data: snapshot
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/group/:groupCreditId/latest', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.params;
      const snapshot = await snapshotService.getLatestSnapshot(groupCreditId);
      if (snapshot) {
        res.json({
          success: true,
          data: {
            exists: true,
            snapshot
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            exists: false,
            snapshot: null
          }
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.get('/group/:groupCreditId', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.params;
      const { startTime, endTime, limit } = req.query;
      
      const start = startTime ? new Date(startTime as string) : undefined;
      const end = endTime ? new Date(endTime as string) : undefined;
      const limitNum = limit ? parseInt(limit as string) : 100;

      const snapshots = await snapshotService.getSnapshotsByGroup(
        groupCreditId,
        start,
        end,
        limitNum
      );

      res.json({
        success: true,
        data: snapshots
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '查询失败'
      });
    }
  });

  router.post('/:snapshotId/validate', async (req: Request, res: Response) => {
    try {
      const { snapshotId } = req.params;
      const result = await snapshotService.validateSnapshot(snapshotId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '校验失败'
      });
    }
  });

  router.post('/group/:groupCreditId/consistency', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.params;
      const result = await snapshotService.verifyConsistency(groupCreditId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '一致性校验失败'
      });
    }
  });

  return router;
}
