import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { prisma } from '../index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { buildingId, type, status } = req.query;
    
    const where = {};
    if (buildingId) where.buildingId = parseInt(buildingId);
    if (type) where.type = type;
    if (status) where.status = status;
    
    const devices = await prisma.device.findMany({
      where,
      include: {
        building: true,
        _count: {
          select: { patrolTasks: true }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    res.json(devices);
  } catch (error) {
    next(error);
  }
});

router.get('/export-csv', async (req, res, next) => {
  try {
    const { buildingId, type, status } = req.query;
    
    const where = {};
    if (buildingId) where.buildingId = parseInt(buildingId);
    if (type) where.type = type;
    if (status) where.status = status;
    
    const devices = await prisma.device.findMany({
      where,
      include: { building: true },
      orderBy: { id: 'asc' }
    });
    
    const records = devices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      buildingName: device.building.name,
      buildingId: device.buildingId,
      location: device.location || '',
      status: device.status,
      lastPatrolAt: device.lastPatrolAt ? device.lastPatrolAt.toISOString().split('T')[0] : '',
      createdAt: device.createdAt.toISOString().split('T')[0]
    }));
    
    const csv = stringify(records, {
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: '设备名称' },
        { key: 'type', header: '设备类型' },
        { key: 'buildingName', header: '所属楼栋' },
        { key: 'buildingId', header: '楼栋ID' },
        { key: 'location', header: '具体位置' },
        { key: 'status', header: '状态' },
        { key: 'lastPatrolAt', header: '上次巡检日期' },
        { key: 'createdAt', header: '创建日期' }
      ]
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=devices_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

router.post('/import-csv', async (req, res, next) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV 内容不能为空' });
    }
    
    const buildings = await prisma.building.findMany();
    const buildingMap = new Map(buildings.map(b => [b.name, b.id]));
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    const errors = [];
    const validRecords = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;
      const rowErrors = [];
      
      if (!record['设备名称'] || !record['设备名称'].trim()) {
        rowErrors.push('设备名称不能为空');
      }
      
      if (!record['设备类型'] || !record['设备类型'].trim()) {
        rowErrors.push('设备类型不能为空');
      }
      
      let buildingId = null;
      if (record['楼栋ID']) {
        buildingId = parseInt(record['楼栋ID']);
        if (isNaN(buildingId)) {
          rowErrors.push('楼栋ID 必须是数字');
        } else {
          const building = await prisma.building.findUnique({
            where: { id: buildingId }
          });
          if (!building) {
            rowErrors.push(`楼栋ID ${buildingId} 不存在`);
          }
        }
      } else if (record['所属楼栋']) {
        buildingId = buildingMap.get(record['所属楼栋'].trim());
        if (!buildingId) {
          rowErrors.push(`楼栋 "${record['所属楼栋']}" 不存在，请先创建该楼栋`);
        }
      } else {
        rowErrors.push('必须提供楼栋ID 或所属楼栋名称');
      }
      
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          record,
          errors: rowErrors
        });
      } else {
        validRecords.push({
          name: record['设备名称'].trim(),
          type: record['设备类型'].trim(),
          buildingId: buildingId,
          location: record['具体位置']?.trim() || null,
          status: record['状态']?.trim() || 'active'
        });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'CSV 数据校验失败',
        totalRecords: records.length,
        validCount: validRecords.length,
        errorCount: errors.length,
        errors
      });
    }
    
    if (validRecords.length === 0) {
      return res.status(400).json({ error: '没有有效的设备记录可导入' });
    }
    
    const createdDevices = [];
    for (const record of validRecords) {
      const device = await prisma.device.create({
        data: record,
        include: { building: true }
      });
      createdDevices.push(device);
    }
    
    res.status(201).json({
      message: `成功导入 ${createdDevices.length} 台设备`,
      count: createdDevices.length,
      devices: createdDevices
    });
  } catch (error) {
    next(error);
  }
});

router.get('/types', async (req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      select: { type: true },
      distinct: ['type']
    });
    const types = devices.map(d => d.type).sort();
    res.json(types);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const device = await prisma.device.findUnique({
      where: { id: parseInt(id) },
      include: {
        building: true,
        patrolTasks: {
          orderBy: { createdAt: 'desc' }
        },
        inspectionTemplates: {
          include: { checkItems: true }
        }
      }
    });
    
    if (!device) {
      return res.status(404).json({ error: '设备不存在' });
    }
    
    res.json(device);
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('name').notEmpty().withMessage('设备名称不能为空'),
    body('type').notEmpty().withMessage('设备类型不能为空'),
    body('buildingId').isInt({ min: 1 }).withMessage('楼栋ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, type, buildingId, location, status } = req.body;
      
      const building = await prisma.building.findUnique({
        where: { id: buildingId }
      });
      
      if (!building) {
        return res.status(400).json({ error: '指定的楼栋不存在' });
      }
      
      const device = await prisma.device.create({
        data: {
          name,
          type,
          buildingId,
          location,
          status: status || 'active'
        },
        include: { building: true }
      });
      
      res.status(201).json(device);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  [
    body('name').notEmpty().withMessage('设备名称不能为空'),
    body('type').notEmpty().withMessage('设备类型不能为空'),
    body('buildingId').isInt({ min: 1 }).withMessage('楼栋ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, type, buildingId, location, status } = req.body;
      
      const existing = await prisma.device.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '设备不存在' });
      }
      
      const building = await prisma.building.findUnique({
        where: { id: buildingId }
      });
      
      if (!building) {
        return res.status(400).json({ error: '指定的楼栋不存在' });
      }
      
      const device = await prisma.device.update({
        where: { id: parseInt(id) },
        data: {
          name,
          type,
          buildingId,
          location,
          status
        },
        include: { building: true }
      });
      
      res.json(device);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const device = await prisma.device.findUnique({
      where: { id: parseInt(id) },
      include: { 
        patrolTasks: true,
        repairOrders: true
      }
    });
    
    if (!device) {
      return res.status(404).json({ error: '设备不存在' });
    }
    
    const hasActiveTasks = device.patrolTasks.some(t => 
      t.status === 'pending' || t.status === 'in_progress'
    );
    const hasActiveOrders = device.repairOrders.some(o =>
      o.status !== 'closed'
    );
    
    if (hasActiveTasks || hasActiveOrders) {
      return res.status(400).json({ 
        error: '该设备有未完成的巡检任务或维修单，无法删除',
        hasActiveTasks,
        hasActiveOrders
      });
    }
    
    await prisma.$transaction([
      prisma.patrolTaskItem.deleteMany({
        where: { patrolTask: { deviceId: parseInt(id) } }
      }),
      prisma.checkItem.deleteMany({
        where: { template: { deviceId: parseInt(id) } }
      }),
      prisma.inspectionTemplate.deleteMany({
        where: { deviceId: parseInt(id) }
      }),
      prisma.patrolTask.deleteMany({
        where: { deviceId: parseInt(id) }
      }),
      prisma.repairOrder.deleteMany({
        where: { deviceId: parseInt(id) }
      }),
      prisma.device.delete({
        where: { id: parseInt(id) }
      })
    ]);
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
