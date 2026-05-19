import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { initDatabase } from '../models/database';
import { TaskService } from '../services/TaskService';
import { ReworkService } from '../services/ReworkService';
import { DeductionService } from '../services/DeductionService';
import { SettlementService } from '../services/SettlementService';
import { ValidationEngine } from '../rules/ValidationEngine';
import { OrderModel } from '../models/OrderModel';
import { PhotoModel } from '../models/PhotoModel';
import { ComplaintModel } from '../models/ComplaintModel';
import { UserModel, AuditLogModel } from '../models/UserModel';
import { DataMaskingService } from '../utils/DataMaskingService';
import { PermissionService } from '../utils/PermissionService';
import { UserRole, TaskStatus, DeductionType, ComplaintStatus, SettlementStatus } from '../types';
import { ReportGenerator } from '../reports/ReportGenerator';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export function createApp(): express.Express {
  initDatabase();
  
  const app = express();
  
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    req.userId = req.headers['x-user-id'] as string || 'system';
    req.userRole = (req.headers['x-user-role'] as UserRole) || UserRole.ADMIN;
    next();
  });

  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/orders', async (req: AuthenticatedRequest, res) => {
    try {
      const orders = OrderModel.list(req.query as any);
      res.json({
        success: true,
        data: DataMaskingService.sanitizeList(orders, req.userRole!, 'orders')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/orders/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const order = OrderModel.getById(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: '订单不存在' });
      }
      res.json({
        success: true,
        data: DataMaskingService.sanitize(order, req.userRole!, 'orders')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/orders', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'orders',
        action: 'create'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const order = OrderModel.create(req.body);
      res.status(201).json({ success: true, data: order });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks', async (req: AuthenticatedRequest, res) => {
    try {
      const filters: any = {};
      if (req.query.cleanerId) filters.cleanerId = req.query.cleanerId as string;
      if (req.query.status) filters.status = req.query.status as TaskStatus;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;

      if (req.userRole === UserRole.CLEANER) {
        filters.cleanerId = req.userId;
      }

      const tasks = TaskService.listTasks(filters);
      res.json({
        success: true,
        data: DataMaskingService.sanitizeList(tasks, req.userRole!, 'tasks')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const task = TaskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, error: '任务不存在' });
      }
      res.json({
        success: true,
        data: DataMaskingService.sanitize(task, req.userRole!, 'tasks')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks/:id/validate', async (req, res) => {
    try {
      const report = await ValidationEngine.validateTaskById(req.params.id);
      res.json({
        success: true,
        data: report,
        explanation: ValidationEngine.explainResults(report.results)
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/assign', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'tasks',
        action: 'assign'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await TaskService.assignTask({
        ...req.body,
        operatorId: req.userId
      });
      
      res.json({
        success: result.success,
        data: result.task,
        isDuplicate: result.isDuplicate,
        error: result.error
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/start', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await TaskService.startTask(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/submit', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await TaskService.submitTask(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/approve', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'tasks',
        action: 'approve'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await TaskService.approveTask(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/reject', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'tasks',
        action: 'reject'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await TaskService.rejectTask(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/complete', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await TaskService.completeTask(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/tasks/:id/photos', async (req: AuthenticatedRequest, res) => {
    try {
      const photo = PhotoModel.create({
        taskId: req.params.id,
        uploaderId: req.userId!,
        photoType: req.body.photoType || 'general',
        photoUrl: req.body.photoUrl,
        thumbnailUrl: req.body.thumbnailUrl,
        fileName: req.body.fileName,
        fileSize: req.body.fileSize || 0
      });
      res.status(201).json({ success: true, data: photo });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks/:id/photos', async (req, res) => {
    try {
      const photos = PhotoModel.getByTaskId(req.params.id);
      res.json({ success: true, data: photos });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/reworks', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'reworks',
        action: 'create'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await ReworkService.createRework({
        ...req.body,
        requesterId: req.userId
      });
      
      res.json({
        success: result.success,
        data: result.rework,
        isDuplicate: result.isDuplicate,
        error: result.error
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/reworks/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const rework = ReworkService.getRework(req.params.id);
      if (!rework) {
        return res.status(404).json({ success: false, error: '返工任务不存在' });
      }
      res.json({
        success: true,
        data: DataMaskingService.sanitize(rework, req.userRole!, 'reworks')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks/:id/reworks', async (req, res) => {
    try {
      const reworks = ReworkService.getReworksByTask(req.params.id);
      res.json({ success: true, data: reworks });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/reworks/:id/start', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await ReworkService.startRework(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/reworks/:id/submit', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await ReworkService.submitRework(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/reworks/:id/approve', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await ReworkService.approveRework(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/reworks/:id/complete', async (req: AuthenticatedRequest, res) => {
    try {
      const result = await ReworkService.completeRework(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/deductions', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'deductions',
        action: 'create'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await DeductionService.createDeduction({
        ...req.body,
        operatorId: req.userId
      });
      
      res.json({
        success: result.success,
        data: result.deduction,
        isDuplicate: result.isDuplicate,
        error: result.error
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/deductions/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const deduction = DeductionService.getDeduction(req.params.id);
      if (!deduction) {
        return res.status(404).json({ success: false, error: '扣款记录不存在' });
      }
      res.json({
        success: true,
        data: DataMaskingService.sanitize(deduction, req.userRole!, 'deductions')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/tasks/:id/deductions', async (req, res) => {
    try {
      const deductions = DeductionService.getDeductionsByTask(req.params.id);
      res.json({ success: true, data: deductions });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/deductions/:id/confirm', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'deductions',
        action: 'confirm'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await DeductionService.confirmDeduction(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/deductions/:id/appeal', async (req, res) => {
    try {
      const result = await DeductionService.appealDeduction(req.params.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/settlements', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'settlements',
        action: 'create'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await SettlementService.createSettlement({
        ...req.body,
        operatorId: req.userId
      });
      
      res.json({
        success: result.success,
        data: result.settlement,
        isDuplicate: result.isDuplicate,
        error: result.error
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/settlements/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const settlement = SettlementService.getSettlement(req.params.id);
      if (!settlement) {
        return res.status(404).json({ success: false, error: '结算单不存在' });
      }
      res.json({
        success: true,
        data: DataMaskingService.sanitize(settlement, req.userRole!, 'settlements')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/settlements/:id/items', async (req, res) => {
    try {
      const data = SettlementService.getSettlementItems(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/settlements', async (req: AuthenticatedRequest, res) => {
    try {
      const filters: any = {};
      if (req.query.cleanerId) filters.cleanerId = req.query.cleanerId as string;
      if (req.query.status) filters.status = req.query.status as SettlementStatus;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;

      if (req.userRole === UserRole.CLEANER) {
        filters.cleanerId = req.userId;
      }

      const settlements = SettlementService.listSettlements(filters);
      res.json({
        success: true,
        data: DataMaskingService.sanitizeList(settlements, req.userRole!, 'settlements')
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/settlements/:id/confirm', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'settlements',
        action: 'confirm'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await SettlementService.confirmSettlement(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/settlements/:id/pay', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'settlements',
        action: 'pay'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const result = await SettlementService.markAsPaid(req.params.id, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/complaints', async (req: AuthenticatedRequest, res) => {
    try {
      const complaint = ComplaintModel.create({
        ...req.body,
        reporterId: req.userId!,
        reporterName: UserModel.getById(req.userId!)?.name || 'Unknown'
      });
      res.status(201).json({ success: true, data: complaint });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/complaints', async (req, res) => {
    try {
      const complaints = ComplaintModel.list(req.query as any);
      res.json({ success: true, data: complaints });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/complaints/:id', async (req, res) => {
    try {
      const complaint = ComplaintModel.getById(req.params.id);
      if (!complaint) {
        return res.status(404).json({ success: false, error: '客诉不存在' });
      }
      res.json({ success: true, data: complaint });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/reports/settlement/:id', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'reports',
        action: 'generate'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const report = ReportGenerator.generateSettlementReport(req.params.id);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/reports/settlement/:id/export', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'reports',
        action: 'export'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const csv = await ReportGenerator.exportSettlementToCSV(req.params.id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="settlement-${req.params.id}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/audit-logs', async (req: AuthenticatedRequest, res) => {
    try {
      if (!PermissionService.checkPermission({
        userId: req.userId!,
        userRole: req.userRole!,
        resourceType: 'audit',
        action: 'read'
      })) {
        return res.status(403).json({ success: false, error: '无权限' });
      }

      const logs = AuditLogModel.list(req.query as any);
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/rules', (req, res) => {
    res.json({
      success: true,
      data: ValidationEngine.getRuleDescriptions()
    });
  });

  app.use('/api/v1', router);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  });

  return app;
}
