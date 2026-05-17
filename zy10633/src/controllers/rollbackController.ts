import { Request, Response } from 'express';
import { rollbackService } from '../services/rollbackService';
import { articleService } from '../services/articleService';
import { RollbackStatus } from '../types';

export class RollbackController {
  async getRollbackRecords(req: Request, res: Response) {
    try {
      const {
        startDate,
        endDate,
        status,
        requestedBy,
        businessObject,
        articleId,
        page = '1',
        pageSize = '10'
      } = req.query;

      const filter = {
        ...(startDate && { startDate: new Date(startDate as string) }),
        ...(endDate && { endDate: new Date(endDate as string) }),
        ...(status && { status: status as RollbackStatus }),
        ...(requestedBy && { requestedBy: requestedBy as string }),
        ...(businessObject && { businessObject: businessObject as string }),
        ...(articleId && { articleId: articleId as string })
      };

      const pagination = {
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10)
      };

      const result = rollbackService.getRollbackRecords(filter, pagination);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }

  async getRollbackRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const record = rollbackService.getRollbackRecord(id);
      
      if (!record) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }

  async getRollbackHistory(req: Request, res: Response) {
    try {
      const { articleId } = req.params;
      const history = rollbackService.getRollbackHistory(articleId);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }

  async requestRollback(req: Request, res: Response) {
    try {
      const { articleId, targetVersion, requestedBy, reason } = req.body;

      if (!articleId || !targetVersion || !requestedBy || !reason) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必填参数: articleId, targetVersion, requestedBy, reason' 
        });
      }

      const result = articleService.requestRollback(articleId, targetVersion, requestedBy, reason);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: '回滚请求失败' });
    }
  }

  async updateRollbackStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, operator, conflictDetails, rejectReason } = req.body;

      if (!status || !operator) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必填参数: status, operator' 
        });
      }

      const result = rollbackService.updateRollbackStatus(id, status, operator, {
        conflictDetails,
        rejectReason
      });

      if (!result) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: '更新失败' });
    }
  }

  async exportToCSV(req: Request, res: Response) {
    try {
      const {
        startDate,
        endDate,
        status,
        requestedBy,
        businessObject,
        articleId
      } = req.query;

      const filter = {
        ...(startDate && { startDate: new Date(startDate as string) }),
        ...(endDate && { endDate: new Date(endDate as string) }),
        ...(status && { status: status as RollbackStatus }),
        ...(requestedBy && { requestedBy: requestedBy as string }),
        ...(businessObject && { businessObject: businessObject as string }),
        ...(articleId && { articleId: articleId as string })
      };

      const csv = await rollbackService.exportToCSV(filter);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=rollback_records.csv');
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, error: '导出失败' });
    }
  }
}

export const rollbackController = new RollbackController();
