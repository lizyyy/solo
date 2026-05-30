import type { Request, Response } from 'express';
import type { RollbackRequest, VersionSnapshot, OperationLog } from '../../../shared/types.js';
import { versionControlService } from '../services/VersionControlService.js';

const DEFAULT_OPERATOR = 'system';

export class VersionControlController {
  listSnapshots(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const snapshots = versionControlService.listSnapshots(limit);
      
      res.json({
        success: true,
        data: snapshots
      });
    } catch (error) {
      console.error('List snapshots error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取版本快照列表失败'
      });
    }
  }

  getSnapshot(req: Request, res: Response): void {
    try {
      const { snapshotId } = req.params;
      const snapshot = versionControlService.getSnapshot(snapshotId);
      
      if (!snapshot) {
        res.status(404).json({
          success: false,
          error: '版本快照不存在'
        });
        return;
      }

      res.json({
        success: true,
        data: snapshot
      });
    } catch (error) {
      console.error('Get snapshot error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取版本快照失败'
      });
    }
  }

  getActiveSnapshot(req: Request, res: Response): void {
    try {
      const snapshot = versionControlService.getActiveSnapshot();
      
      res.json({
        success: true,
        data: snapshot
      });
    } catch (error) {
      console.error('Get active snapshot error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取当前版本失败'
      });
    }
  }

  setActiveSnapshot(req: Request, res: Response): void {
    try {
      const { snapshotId } = req.params;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;
      
      const snapshot = versionControlService.setActiveSnapshot(snapshotId, operator);
      
      res.json({
        success: true,
        data: snapshot,
        message: '版本切换成功'
      });
    } catch (error) {
      console.error('Set active snapshot error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '切换版本失败'
      });
    }
  }

  async rollback(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as RollbackRequest;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;
      
      const result = await versionControlService.rollback(request, operator);
      
      res.json({
        success: true,
        data: result,
        message: '撤回成功，已创建新版本'
      });
    } catch (error) {
      console.error('Rollback error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '撤回操作失败'
      });
    }
  }

  undoOperation(req: Request, res: Response): void {
    try {
      const { logId } = req.params;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;
      
      const result = versionControlService.undoOperation(logId, operator);
      
      res.json({
        success: true,
        data: result,
        message: '操作撤回成功'
      });
    } catch (error) {
      console.error('Undo operation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '撤回操作失败'
      });
    }
  }

  listOperationLogs(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = versionControlService.listOperationLogs(limit);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('List operation logs error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取操作日志失败'
      });
    }
  }

  compareVersions(req: Request, res: Response): void {
    try {
      const { snapshotId1, snapshotId2 } = req.params;
      
      const result = versionControlService.compareVersions(snapshotId1, snapshotId2);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Compare versions error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '版本对比失败'
      });
    }
  }

  createSnapshot(req: Request, res: Response): void {
    try {
      const { name, description } = req.body;
      const operator = req.headers['x-operator'] as string || DEFAULT_OPERATOR;
      
      if (!name) {
        res.status(400).json({
          success: false,
          error: '请输入版本名称'
        });
        return;
      }

      const snapshot = versionControlService.createSnapshot(
        name,
        description || '',
        operator
      );
      
      res.json({
        success: true,
        data: snapshot,
        message: '版本快照创建成功'
      });
    } catch (error) {
      console.error('Create snapshot error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '创建版本快照失败'
      });
    }
  }
}

export const versionControlController = new VersionControlController();
