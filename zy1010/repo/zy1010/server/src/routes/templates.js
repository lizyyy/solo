import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    
    const where = {};
    if (deviceId) where.deviceId = parseInt(deviceId);
    
    const templates = await prisma.inspectionTemplate.findMany({
      where,
      include: {
        device: { include: { building: true } },
        checkItems: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await prisma.inspectionTemplate.findUnique({
      where: { id: parseInt(id) },
      include: {
        device: { include: { building: true } },
        checkItems: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (!template) {
      return res.status(404).json({ error: '巡检模板不存在' });
    }
    
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('name').notEmpty().withMessage('模板名称不能为空'),
    body('deviceId').isInt({ min: 1 }).withMessage('设备ID 必须是正整数'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, deviceId, checkItems } = req.body;
      
      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });
      
      if (!device) {
        return res.status(400).json({ error: '指定的设备不存在' });
      }
      
      const template = await prisma.inspectionTemplate.create({
        data: {
          name,
          deviceId,
          checkItems: checkItems ? {
            create: checkItems.map((item, index) => ({
              name: item.name,
              description: item.description,
              sortOrder: item.sortOrder ?? index
            }))
          } : undefined
        },
        include: {
          checkItems: { orderBy: { sortOrder: 'asc' } },
          device: { include: { building: true } }
        }
      });
      
      res.status(201).json(template);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  [
    body('name').notEmpty().withMessage('模板名称不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, checkItems } = req.body;
      
      const existing = await prisma.inspectionTemplate.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '巡检模板不存在' });
      }
      
      let template;
      if (checkItems !== undefined) {
        await prisma.checkItem.deleteMany({
          where: { templateId: parseInt(id) }
        });
        
        template = await prisma.inspectionTemplate.update({
          where: { id: parseInt(id) },
          data: {
            name,
            checkItems: {
              create: checkItems.map((item, index) => ({
                name: item.name,
                description: item.description,
                sortOrder: item.sortOrder ?? index
              }))
            }
          },
          include: {
            checkItems: { orderBy: { sortOrder: 'asc' } },
            device: { include: { building: true } }
          }
        });
      } else {
        template = await prisma.inspectionTemplate.update({
          where: { id: parseInt(id) },
          data: { name },
          include: {
            checkItems: { orderBy: { sortOrder: 'asc' } },
            device: { include: { building: true } }
          }
        });
      }
      
      res.json(template);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const template = await prisma.inspectionTemplate.findUnique({
      where: { id: parseInt(id) },
      include: { checkItems: true }
    });
    
    if (!template) {
      return res.status(404).json({ error: '巡检模板不存在' });
    }
    
    await prisma.$transaction([
      prisma.checkItem.deleteMany({
        where: { templateId: parseInt(id) }
      }),
      prisma.inspectionTemplate.delete({
        where: { id: parseInt(id) }
      })
    ]);
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/check-items',
  [
    body('name').notEmpty().withMessage('检查项名称不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, description, sortOrder } = req.body;
      
      const template = await prisma.inspectionTemplate.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!template) {
        return res.status(404).json({ error: '巡检模板不存在' });
      }
      
      const existingItems = await prisma.checkItem.findMany({
        where: { templateId: parseInt(id) },
        select: { sortOrder: true }
      });
      
      const maxSortOrder = existingItems.length > 0 
        ? Math.max(...existingItems.map(i => i.sortOrder))
        : -1;
      
      const checkItem = await prisma.checkItem.create({
        data: {
          name,
          description,
          templateId: parseInt(id),
          sortOrder: sortOrder !== undefined ? sortOrder : maxSortOrder + 1
        }
      });
      
      res.status(201).json(checkItem);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/check-items/:itemId',
  [
    body('name').notEmpty().withMessage('检查项名称不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { itemId } = req.params;
      const { name, description, sortOrder } = req.body;
      
      const existing = await prisma.checkItem.findUnique({
        where: { id: parseInt(itemId) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '检查项不存在' });
      }
      
      const checkItem = await prisma.checkItem.update({
        where: { id: parseInt(itemId) },
        data: {
          name,
          description,
          sortOrder
        }
      });
      
      res.json(checkItem);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/check-items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    
    const checkItem = await prisma.checkItem.findUnique({
      where: { id: parseInt(itemId) }
    });
    
    if (!checkItem) {
      return res.status(404).json({ error: '检查项不存在' });
    }
    
    await prisma.checkItem.delete({
      where: { id: parseInt(itemId) }
    });
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
