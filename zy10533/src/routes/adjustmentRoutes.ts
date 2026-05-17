import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { QueueAdjustmentService } from '../services/queueAdjustmentService';
import { ExportService } from '../services/exportService';
import { AdjustmentStatus, PriorityLevel } from '../types';

const router = Router();

const createAdjustmentSchema = Joi.object({
  idempotencyKey: Joi.string().required(),
  queueName: Joi.string().required(),
  targetPriority: Joi.number().valid(...Object.values(PriorityLevel)).required(),
  reason: Joi.string().required(),
  recoveryCondition: Joi.string().required(),
  scheduledAt: Joi.date().optional(),
  createdBy: Joi.string().required()
});

const manualCorrectionSchema = Joi.object({
  newPriority: Joi.number().valid(...Object.values(PriorityLevel)).optional(),
  newRecoveryCondition: Joi.string().optional(),
  reason: Joi.string().required(),
  correctedBy: Joi.string().required()
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createAdjustmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const adjustment = await QueueAdjustmentService.createAdjustment(value);
    res.status(201).json(adjustment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, queueName } = req.query;
    const filters: any = {};
    if (status && Object.values(AdjustmentStatus).includes(status as any)) {
      filters.status = status as AdjustmentStatus;
    }
    if (queueName) {
      filters.queueName = queueName as string;
    }

    const adjustments = await QueueAdjustmentService.getAllAdjustments(filters);
    res.json(adjustments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const adjustment = await QueueAdjustmentService.getAdjustmentById(req.params.id);
    if (!adjustment) {
      return res.status(404).json({ error: '调整记录不存在' });
    }
    res.json(adjustment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await QueueAdjustmentService.getAffectedTasks(req.params.id);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/failures', async (req: Request, res: Response) => {
  try {
    const failures = await QueueAdjustmentService.getFailureRecords(req.params.id);
    res.json(failures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    await QueueAdjustmentService.activateAdjustment(req.params.id);
    res.json({ message: '调整已激活' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/recover', async (req: Request, res: Response) => {
  try {
    await QueueAdjustmentService.startRecovery(req.params.id);
    res.json({ message: '恢复操作已完成，优先级已还原' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/correct', async (req: Request, res: Response) => {
  try {
    const { error, value } = manualCorrectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await QueueAdjustmentService.applyManualCorrection({
      adjustmentId: req.params.id,
      ...value
    });
    res.json({ message: '人工修正已应用' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    await QueueAdjustmentService.cancelAdjustment(req.params.id);
    res.json({ message: '调整已取消' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/export/csv', async (req: Request, res: Response) => {
  try {
    const filepath = await ExportService.exportAdjustmentToCSV(req.params.id);
    res.download(filepath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/export/report', async (req: Request, res: Response) => {
  try {
    const adjustment = await QueueAdjustmentService.getAdjustmentById(req.params.id);
    if (!adjustment) {
      return res.status(404).json({ error: '调整记录不存在' });
    }
    const tasks = await QueueAdjustmentService.getAffectedTasks(req.params.id);
    const failures = await QueueAdjustmentService.getFailureRecords(req.params.id);
    const report = ExportService.generateTextSummary(adjustment, tasks, failures);
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/failures/:failureId/resolve', async (req: Request, res: Response) => {
  try {
    const { conclusion } = req.body;
    if (!conclusion) {
      return res.status(400).json({ error: '必须提供处理结论' });
    }
    await QueueAdjustmentService.resolveFailure(req.params.failureId, conclusion);
    res.json({ message: '异常已标记为已解决' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/queues/:name/priority', async (req: Request, res: Response) => {
  try {
    const priority = await QueueAdjustmentService.getCurrentQueuePriority(req.params.name);
    res.json({ queueName: req.params.name, currentPriority: priority });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
