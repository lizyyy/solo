import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../index.js';
import { isBefore } from 'date-fns';

const router = Router();

const STATUS_LABELS = {
  'pending_assignment': '待分派',
  'in_progress': '处理中',
  'pending_review': '待复核',
  'closed': '已关闭'
};

router.get('/', async (req, res, next) => {
  try {
    const { buildingId, deviceType, status, workerId, overdue } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (workerId) where.workerId = parseInt(workerId);
    
    if (buildingId) {
      where.device = { buildingId: parseInt(buildingId) };
    }
    if (deviceType) {
      if (!where.device) where.device = {};
      where.device.type = deviceType;
    }
    
    if (overdue === 'true') {
      where.AND = [
        { dueDate: { lt: new Date() } },
        { status: { notIn: ['closed'] } }
      ];
    }
    
    const repairOrders = await prisma.repairOrder.findMany({
      where,
      include: {
        device: { include: { building: true } },
        worker: true,
        patrolTask: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const ordersWithStatus = repairOrders.map(order => ({
      ...order,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      isOverdue: order.dueDate && order.status !== 'closed' && isBefore(new Date(order.dueDate), new Date())
    }));
    
    res.json(ordersWithStatus);
  } catch (error) {
    next(error);
  }
});

router.get('/export-csv', async (req, res, next) => {
  try {
    const { buildingId, deviceType, status, workerId, overdue } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (workerId) where.workerId = parseInt(workerId);
    
    if (buildingId) {
      where.device = { buildingId: parseInt(buildingId) };
    }
    if (deviceType) {
      if (!where.device) where.device = {};
      where.device.type = deviceType;
    }
    
    if (overdue === 'true') {
      where.AND = [
        { dueDate: { lt: new Date() } },
        { status: { notIn: ['closed'] } }
      ];
    }
    
    const repairOrders = await prisma.repairOrder.findMany({
      where,
      include: {
        device: { include: { building: true } },
        worker: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const records = repairOrders.map(order => ({
      id: order.id,
      title: order.title,
      description: order.description || '',
      status: STATUS_LABELS[order.status] || order.status,
      building: order.device.building.name,
      device: order.device.name,
      deviceType: order.device.type,
      worker: order.worker?.name || '未分派',
      skillRequired: order.skillRequired || '',
      estimatedMinutes: order.estimatedMinutes || '',
      dueDate: order.dueDate ? order.dueDate.toISOString().split('T')[0] : '',
      isOverdue: order.dueDate && order.status !== 'closed' && isBefore(new Date(order.dueDate), new Date()) ? '是' : '否',
      createdAt: order.createdAt.toISOString().split('T')[0],
      completedAt: order.completedAt ? order.completedAt.toISOString().split('T')[0] : ''
    }));
    
    const csv = stringify(records, {
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'title', header: '标题' },
        { key: 'description', header: '描述' },
        { key: 'status', header: '状态' },
        { key: 'building', header: '所属楼栋' },
        { key: 'device', header: '设备名称' },
        { key: 'deviceType', header: '设备类型' },
        { key: 'worker', header: '负责人' },
        { key: 'skillRequired', header: '所需技能' },
        { key: 'estimatedMinutes', header: '预计耗时(分钟)' },
        { key: 'dueDate', header: '截止日期' },
        { key: 'isOverdue', header: '是否逾期' },
        { key: 'createdAt', header: '创建日期' },
        { key: 'completedAt', header: '完成日期' }
      ]
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=repair_orders_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await prisma.repairOrder.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });
    
    const overdue = await prisma.repairOrder.count({
      where: {
        AND: [
          { dueDate: { lt: new Date() } },
          { status: { notIn: ['closed'] } }
        ]
      }
    });
    
    const result = {
      byStatus: {},
      overdue,
      total: 0
    };
    
    stats.forEach(s => {
      result.byStatus[s.status] = s._count.id;
      result.total += s._count.id;
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const repairOrder = await prisma.repairOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        device: { include: { building: true } },
        worker: true,
        patrolTask: {
          include: { items: { include: { checkItem: true } } }
        }
      }
    });
    
    if (!repairOrder) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    res.json({
      ...repairOrder,
      statusLabel: STATUS_LABELS[repairOrder.status] || repairOrder.status,
      isOverdue: repairOrder.dueDate && repairOrder.status !== 'closed' && 
        isBefore(new Date(repairOrder.dueDate), new Date())
    });
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('title').notEmpty().withMessage('维修单标题不能为空'),
    body('deviceId').isInt({ min: 1 }).withMessage('设备ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        title, description, deviceId, skillRequired, 
        estimatedMinutes, dueDate, workerId 
      } = req.body;
      
      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });
      
      if (!device) {
        return res.status(400).json({ error: '指定的设备不存在' });
      }
      
      let worker = null;
      if (workerId) {
        worker = await prisma.worker.findUnique({
          where: { id: workerId }
        });
        if (!worker) {
          return res.status(400).json({ error: '指定的维修师傅不存在' });
        }
      }
      
      const repairOrder = await prisma.repairOrder.create({
        data: {
          title,
          description,
          deviceId,
          skillRequired,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          workerId,
          status: workerId ? 'in_progress' : 'pending_assignment'
        },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      });
      
      res.status(201).json({
        ...repairOrder,
        statusLabel: STATUS_LABELS[repairOrder.status]
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id/assign',
  [
    body('workerId').isInt({ min: 1 }).withMessage('维修师傅ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { workerId } = req.body;
      
      const repairOrder = await prisma.repairOrder.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!repairOrder) {
        return res.status(404).json({ error: '维修单不存在' });
      }
      
      if (repairOrder.status === 'closed') {
        return res.status(400).json({ error: '已关闭的维修单无法派单' });
      }
      
      const worker = await prisma.worker.findUnique({
        where: { id: workerId }
      });
      
      if (!worker) {
        return res.status(400).json({ error: '指定的维修师傅不存在' });
      }
      
      const updated = await prisma.repairOrder.update({
        where: { id: parseInt(id) },
        data: {
          workerId,
          status: 'in_progress'
        },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      });
      
      res.json({
        ...updated,
        statusLabel: STATUS_LABELS[updated.status]
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id/submit',
  [
    body('processingNotes').notEmpty().withMessage('处理记录不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { processingNotes } = req.body;
      
      const repairOrder = await prisma.repairOrder.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!repairOrder) {
        return res.status(404).json({ error: '维修单不存在' });
      }
      
      if (repairOrder.status !== 'in_progress') {
        return res.status(400).json({ 
          error: '只能提交处理中的维修单',
          currentStatus: repairOrder.status
        });
      }
      
      const updated = await prisma.repairOrder.update({
        where: { id: parseInt(id) },
        data: {
          status: 'pending_review',
          processingNotes
        },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      });
      
      res.json({
        ...updated,
        statusLabel: STATUS_LABELS[updated.status]
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id/review',
  [
    body('approved').isBoolean().withMessage('必须指定是否通过复核'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { approved, reviewNotes, reviewedBy } = req.body;
      
      const repairOrder = await prisma.repairOrder.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!repairOrder) {
        return res.status(404).json({ error: '维修单不存在' });
      }
      
      if (repairOrder.status !== 'pending_review') {
        return res.status(400).json({ 
          error: '只能复核待复核状态的维修单',
          currentStatus: repairOrder.status
        });
      }
      
      let newStatus, completedAt = null;
      if (approved) {
        newStatus = 'closed';
        completedAt = new Date();
      } else {
        newStatus = 'in_progress';
      }
      
      const updated = await prisma.repairOrder.update({
        where: { id: parseInt(id) },
        data: {
          status: newStatus,
          completedAt,
          reviewedBy: reviewedBy || '复核人',
          reviewNotes
        },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      });
      
      res.json({
        ...updated,
        statusLabel: STATUS_LABELS[updated.status],
        message: approved ? '复核通过，维修单已关闭' : '复核不通过，打回重新处理'
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  [
    body('title').notEmpty().withMessage('维修单标题不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { 
        title, description, skillRequired, 
        estimatedMinutes, dueDate
      } = req.body;
      
      const existing = await prisma.repairOrder.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '维修单不存在' });
      }
      
      const updated = await prisma.repairOrder.update({
        where: { id: parseInt(id) },
        data: {
          title,
          description,
          skillRequired,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          dueDate: dueDate ? new Date(dueDate) : null
        },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      });
      
      res.json({
        ...updated,
        statusLabel: STATUS_LABELS[updated.status]
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const repairOrder = await prisma.repairOrder.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!repairOrder) {
      return res.status(404).json({ error: '维修单不存在' });
    }
    
    if (repairOrder.status === 'in_progress' || repairOrder.status === 'pending_review') {
      return res.status(400).json({ 
        error: '进行中或待复核的维修单无法删除',
        currentStatus: repairOrder.status
      });
    }
    
    await prisma.repairOrder.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
