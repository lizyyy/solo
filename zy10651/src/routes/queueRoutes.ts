import { Router, Request, Response } from 'express';
import { queueService } from '../services/QueueService';
import { exportService } from '../services/ExportService';
import { CreateQueueRequest, QueryFilter, QueueStatus, RecordStatus } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const request: CreateQueueRequest = req.body;
    const record = queueService.createQueueRecord(request);
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '创建排队记录失败'
    });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const filter: QueryFilter = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20
    };

    if (req.query.startDate) {
      filter.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filter.endDate = new Date(req.query.endDate as string);
    }
    if (req.query.status) {
      filter.status = req.query.status as QueueStatus;
    }
    if (req.query.recordStatus) {
      filter.recordStatus = req.query.recordStatus as RecordStatus;
    }
    if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId as string;
    }
    if (req.query.businessObject) {
      filter.businessObject = req.query.businessObject as string;
    }
    if (req.query.skillGroupId) {
      filter.skillGroupId = req.query.skillGroupId as string;
    }
    if (req.query.visitorId) {
      filter.visitorId = req.query.visitorId as string;
    }

    const result = queueService.queryRecords(filter);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = queueService.getQueueRecord(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const history = queueService.getStatusHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '查询历史失败'
    });
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status, operatorId, operatorName, reason } = req.body;
    const record = queueService.updateStatus(
      req.params.id,
      status,
      operatorId,
      operatorName,
      reason
    );
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在或状态不允许更新'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '更新状态失败'
    });
  }
});

router.post('/:id/overflow', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = req.body;
    const result = queueService.processOverflow(req.params.id, operatorId, operatorName);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '溢出处理失败'
    });
  }
});

router.post('/:id/withdraw', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = req.body;
    const record = queueService.withdrawQueueRecord(req.params.id, operatorId, operatorName);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在或状态不允许撤回'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '撤回失败'
    });
  }
});

router.post('/:id/resubmit', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = req.body;
    const record = queueService.resubmitQueueRecord(req.params.id, operatorId, operatorName);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在或状态不允许重新提交'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '重新提交失败'
    });
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, reason } = req.body;
    const record = queueService.rejectRecord(req.params.id, operatorId, operatorName, reason);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '驳回失败'
    });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const filter: QueryFilter = req.body.filter || {};
    const filePath = await exportService.exportToCsv(filter);
    res.download(filePath);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const result = await exportService.importFromJson(data);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '导入失败'
    });
  }
});

export default router;