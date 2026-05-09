import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { taskService } from '../services/TaskService';
import { auditService } from '../services/AuditService';
import { EntityType } from '@prisma/client';
import { exportService } from '../services/ExportService';
import { wsService } from '../services/WebSocketService';
import { VersionConflictError } from '../services/LockService';

const router = Router();

const createTaskSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  orderNumber: z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  refundAmount: z.number().min(0).optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  orderNumber: z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  refundAmount: z.number().min(0).optional().nullable(),
  expectedVersion: z.number().int().min(1),
});

const listTasksSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REOPENED']).array().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).array().optional(),
  assigneeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(100).optional(),
});

const rollbackSchema = z.object({
  versionNumber: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});

router.use(authMiddleware);

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const result = await taskService.createTask(data, req.context);

    if (!result.isDuplicate) {
      wsService.broadcastTaskCreated(result.task);
    }

    res.status(201).json({
      data: result.task,
      isDuplicate: result.isDuplicate,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const filters = listTasksSchema.parse(req.query);

    const result = await taskService.listTasks({
      status: filters.status as TaskStatus[] | undefined,
      priority: filters.priority as TaskPriority[] | undefined,
      assigneeId: filters.assigneeId,
      customerId: filters.customerId,
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const task = await taskService.getTask(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found',
      });
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const data = updateTaskSchema.parse(req.body);

    const updatedTask = await taskService.updateTask(
      req.params.id,
      data,
      req.context
    );

    wsService.broadcastTaskUpdate(req.params.id, { task: updatedTask });

    res.json({ data: updatedTask });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      wsService.broadcastVersionConflict(req.params.id, error);
    }
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const reason = req.body.reason as string;

    await taskService.deleteTask(req.params.id, req.context, reason);

    wsService.broadcastTaskDeleted(req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions', async (req: Request, res: Response, next) => {
  try {
    const versions = await taskService.getTaskVersions(req.params.id);

    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/rollback', async (req: Request, res: Response, next) => {
  try {
    const { versionNumber, reason } = rollbackSchema.parse(req.body);

    const rolledBackTask = await taskService.rollbackToVersion(
      req.params.id,
      versionNumber,
      req.context,
      reason
    );

    wsService.broadcastTaskUpdate(req.params.id, { task: rolledBackTask, rollback: true });

    res.json({ data: rolledBackTask });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req: Request, res: Response, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await auditService.getEntityHistory(
      EntityType.TASK,
      req.params.id,
      Math.min(limit, 100),
      offset
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/replay', async (req: Request, res: Response, next) => {
  try {
    const history = await auditService.replayEntityChanges(
      EntityType.TASK,
      req.params.id
    );

    res.json({ data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/export/:format', async (req: Request, res: Response, next) => {
  try {
    const format = req.params.format as 'excel' | 'markdown' | 'pdf';

    if (!['excel', 'markdown', 'pdf'].includes(format)) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Format must be one of: excel, markdown, pdf',
      });
    }

    const filters = {
      status: (req.query.status as string)?.split(',') as TaskStatus[] | undefined,
      priority: (req.query.priority as string)?.split(',') as TaskPriority[] | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const buffer = await exportService.exportTasks(format, filters, req.context);

    const contentType = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      markdown: 'text/markdown; charset=utf-8',
      pdf: 'application/pdf',
    }[format];

    const fileExtension = {
      excel: 'xlsx',
      markdown: 'md',
      pdf: 'pdf',
    }[format];

    const filename = `tasks_${Date.now()}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/export/:format', async (req: Request, res: Response, next) => {
  try {
    const format = req.params.format as 'excel' | 'markdown' | 'pdf';

    if (!['excel', 'markdown', 'pdf'].includes(format)) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Format must be one of: excel, markdown, pdf',
      });
    }

    const buffer = await exportService.exportSingleTask(
      req.params.id,
      format,
      req.context
    );

    const contentType = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      markdown: 'text/markdown; charset=utf-8',
      pdf: 'application/pdf',
    }[format];

    const fileExtension = {
      excel: 'xlsx',
      markdown: 'md',
      pdf: 'pdf',
    }[format];

    const filename = `task_${req.params.id}_${Date.now()}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;