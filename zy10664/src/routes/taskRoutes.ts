import express, { Request, Response } from 'express';
import { Parser } from 'json2csv';
import { taskService } from '../services/taskService';
import {
  CreateTaskRequest,
  UpdateTaskRequest,
  ApplyRecoveryRequest,
  AuditRecoveryRequest,
  WithdrawRequest,
  ManualRemarkRequest,
  RecordFailureRequest,
  TaskQuery
} from '../types';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateTaskRequest = req.body;
    const result = taskService.createTask(request);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = taskService.getTaskDetail(id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: UpdateTaskRequest = req.body;
    const result = taskService.updateTask(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const query: TaskQuery = {
      status: req.query.status as any,
      taskCode: req.query.taskCode as string,
      schedulerName: req.query.schedulerName as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined
    };
    
    const result = taskService.listTasks(query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/:id/failure', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: RecordFailureRequest = req.body;
    const result = taskService.recordFailure(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/:id/apply-recovery', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: ApplyRecoveryRequest = req.body;
    const result = taskService.applyRecovery(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/:id/audit-recovery', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: AuditRecoveryRequest = req.body;
    const result = taskService.auditRecovery(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: WithdrawRequest = req.body;
    const result = taskService.withdraw(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/:id/manual-remark', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: ManualRemarkRequest = req.body;
    const result = taskService.addManualRemark(id, request);
    
    if (!result.success) {
      return res.status(result.message ? 404 : 400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.put('/:taskId/conditions/:conditionId/meet', async (req: Request, res: Response) => {
  try {
    const { taskId, conditionId } = req.params;
    const { operator } = req.body;
    const result = taskService.meetRecoveryCondition(taskId, conditionId, operator);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const result = taskService.exportTasks();
    
    const fields = [
      { label: '任务ID', value: 'id' },
      { label: '任务名称', value: 'taskName' },
      { label: '任务编码', value: 'taskCode' },
      { label: '调度器名称', value: 'schedulerName' },
      { label: '状态', value: 'status' },
      { label: '失败次数', value: 'failureCount' },
      { label: '熔断原因', value: 'fuseReason' },
      { label: '熔断时间', value: 'fusedAt' },
      { label: '恢复申请时间', value: 'recoveryApplyAt' },
      { label: '恢复完成时间', value: 'recoveredAt' },
      { label: '恢复申请人', value: 'recoveryApplicant' },
      { label: '恢复审核人', value: 'recoveryAuditor' },
      { label: '恢复说明', value: 'recoveryRemark' },
      { label: '人工备注', value: 'manualRemark' },
      { label: '是否有队列重试', value: 'hasQueuedRetry' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(result.data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, message: '导入数据必须是数组' });
    }
    
    const result = taskService.importTasks(data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

export default router;
