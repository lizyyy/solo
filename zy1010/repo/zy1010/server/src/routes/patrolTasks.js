import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';

const router = Router();

const parsePhotoUrls = (item) => {
  if (!item) return item;
  let photoUrls = [];
  if (typeof item.photoUrls === 'string') {
    try {
      photoUrls = JSON.parse(item.photoUrls);
    } catch {
      photoUrls = [];
    }
  } else if (Array.isArray(item.photoUrls)) {
    photoUrls = item.photoUrls;
  }
  return { ...item, photoUrls };
};

const parseTaskItems = (task) => {
  if (!task) return task;
  if (task.items && Array.isArray(task.items)) {
    task.items = task.items.map(parsePhotoUrls);
  }
  return task;
};

router.get('/', async (req, res, next) => {
  try {
    const { deviceId, status, buildingId } = req.query;
    
    const where = {};
    if (deviceId) where.deviceId = parseInt(deviceId);
    if (status) where.status = status;
    if (buildingId) {
      where.device = { buildingId: parseInt(buildingId) };
    }
    
    let patrolTasks = await prisma.patrolTask.findMany({
      where,
      include: {
        device: { include: { building: true } },
        items: {
          include: { checkItem: true }
        },
        repairOrders: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    patrolTasks = patrolTasks.map(parseTaskItems);
    
    res.json(patrolTasks);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let patrolTask = await prisma.patrolTask.findUnique({
      where: { id: parseInt(id) },
      include: {
        device: { 
          include: { 
            building: true,
            inspectionTemplates: {
              include: { checkItems: { orderBy: { sortOrder: 'asc' } } }
            }
          }
        },
        items: {
          include: { checkItem: true },
          orderBy: { id: 'asc' }
        },
        repairOrders: {
          include: { worker: true }
        }
      }
    });
    
    if (!patrolTask) {
      return res.status(404).json({ error: '巡检任务不存在' });
    }
    
    patrolTask = parseTaskItems(patrolTask);
    
    res.json(patrolTask);
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('name').notEmpty().withMessage('任务名称不能为空'),
    body('deviceId').isInt({ min: 1 }).withMessage('设备ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, deviceId, scheduledAt, templateId } = req.body;
      
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: { inspectionTemplates: { include: { checkItems: true } } }
      });
      
      if (!device) {
        return res.status(400).json({ error: '指定的设备不存在' });
      }
      
      let selectedTemplate = null;
      if (templateId) {
        selectedTemplate = device.inspectionTemplates.find(t => t.id === templateId);
        if (!selectedTemplate) {
          return res.status(400).json({ error: '指定的巡检模板不存在' });
        }
      } else if (device.inspectionTemplates.length > 0) {
        selectedTemplate = device.inspectionTemplates[0];
      }
      
      let patrolTask = await prisma.patrolTask.create({
        data: {
          name,
          deviceId,
          status: 'pending',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          items: selectedTemplate && selectedTemplate.checkItems.length > 0 ? {
            create: selectedTemplate.checkItems.map((item, index) => ({
              checkItemId: item.id,
              result: null,
              isAbnormal: false,
              photoUrls: JSON.stringify([])
            }))
          } : undefined
        },
        include: {
          device: { include: { building: true } },
          items: {
            include: { checkItem: true }
          }
        }
      });
      
      patrolTask = parseTaskItems(patrolTask);
      
      res.status(201).json(patrolTask);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let patrolTask = await prisma.patrolTask.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!patrolTask) {
      return res.status(404).json({ error: '巡检任务不存在' });
    }
    
    if (patrolTask.status !== 'pending') {
      return res.status(400).json({ 
        error: '只能开始待处理的巡检任务',
        currentStatus: patrolTask.status
      });
    }
    
    let updated = await prisma.patrolTask.update({
      where: { id: parseInt(id) },
      data: { status: 'in_progress' },
      include: {
        device: { include: { building: true } },
        items: {
          include: { checkItem: true }
        }
      }
    });
    
    updated = parseTaskItems(updated);
    
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let patrolTask = await prisma.patrolTask.findUnique({
      where: { id: parseInt(id) },
      include: { 
        items: true,
        device: { include: { building: true } }
      }
    });
    
    if (!patrolTask) {
      return res.status(404).json({ error: '巡检任务不存在' });
    }
    
    if (patrolTask.status !== 'in_progress') {
      return res.status(400).json({ 
        error: '只能完成进行中的巡检任务',
        currentStatus: patrolTask.status
      });
    }
    
    const hasAbnormalItems = patrolTask.items.some(item => item.isAbnormal === true);
    
    const completedAt = new Date();
    
    const updated = await prisma.$transaction(async (tx) => {
      let task = await tx.patrolTask.update({
        where: { id: parseInt(id) },
        data: { 
          status: 'completed',
          completedAt
        },
        include: {
          device: { include: { building: true } },
          items: {
            include: { checkItem: true }
          }
        }
      });
      
      await tx.device.update({
        where: { id: task.deviceId },
        data: { lastPatrolAt: completedAt }
      });
      
      if (hasAbnormalItems) {
        const abnormalItems = task.items.filter(item => item.isAbnormal);
        const abnormalNotes = abnormalItems
          .map(item => `${item.checkItem?.name || '检查项'}: ${item.notes || item.result || '异常'}`)
          .join('；\n');
        
        await tx.repairOrder.create({
          data: {
            title: `巡检异常：${task.name}`,
            description: `来自巡检任务的异常记录：\n${abnormalNotes}`,
            status: 'pending_assignment',
            patrolTaskId: task.id,
            deviceId: task.deviceId
          }
        });
      }
      
      return task;
    });
    
    const updatedTask = parseTaskItems(updated);
    
    res.json({
      ...updatedTask,
      hasAbnormalItems,
      message: hasAbnormalItems ? '巡检完成，已自动生成维修单' : '巡检完成'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/items/:itemId',
  [
  ],
  async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const { result, photoUrls, notes, isAbnormal } = req.body;
      
      const existing = await prisma.patrolTaskItem.findUnique({
        where: { id: parseInt(itemId) },
        include: { patrolTask: true }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '巡检项不存在' });
      }
      
      if (existing.patrolTask.status === 'completed') {
        return res.status(400).json({ error: '该巡检任务已完成，无法修改' });
      }
      
      let updated = await prisma.patrolTaskItem.update({
        where: { id: parseInt(itemId) },
        data: {
          result,
          photoUrls: photoUrls ? JSON.stringify(photoUrls) : JSON.stringify([]),
          notes,
          isAbnormal: isAbnormal !== undefined ? isAbnormal : false
        },
        include: { checkItem: true }
      });
      
      updated = parsePhotoUrls(updated);
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const patrolTask = await prisma.patrolTask.findUnique({
      where: { id: parseInt(id) },
      include: { 
        items: true,
        repairOrders: true
      }
    });
    
    if (!patrolTask) {
      return res.status(404).json({ error: '巡检任务不存在' });
    }
    
    if (patrolTask.status === 'in_progress') {
      return res.status(400).json({ error: '进行中的巡检任务无法删除' });
    }
    
    if (patrolTask.repairOrders.length > 0) {
      return res.status(400).json({ 
        error: '该巡检任务已生成维修单，无法删除',
        repairOrderCount: patrolTask.repairOrders.length
      });
    }
    
    await prisma.$transaction([
      prisma.patrolTaskItem.deleteMany({
        where: { patrolTaskId: parseInt(id) }
      }),
      prisma.patrolTask.delete({
        where: { id: parseInt(id) }
      })
    ]);
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
