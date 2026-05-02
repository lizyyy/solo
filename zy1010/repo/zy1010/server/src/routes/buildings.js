import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const buildings = await prisma.building.findMany({
      include: {
        _count: {
          select: { devices: true }
        }
      },
      orderBy: { id: 'asc' }
    });
    res.json(buildings);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const building = await prisma.building.findUnique({
      where: { id: parseInt(id) },
      include: {
        devices: {
          include: {
            _count: {
              select: { patrolTasks: true }
            }
          }
        }
      }
    });
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }
    
    res.json(building);
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('name').notEmpty().withMessage('楼栋名称不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, description, location } = req.body;
      
      const building = await prisma.building.create({
        data: {
          name,
          description,
          location
        }
      });
      
      res.status(201).json(building);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  [
    body('name').notEmpty().withMessage('楼栋名称不能为空'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, description, location } = req.body;
      
      const existing = await prisma.building.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '楼栋不存在' });
      }
      
      const building = await prisma.building.update({
        where: { id: parseInt(id) },
        data: {
          name,
          description,
          location
        }
      });
      
      res.json(building);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const building = await prisma.building.findUnique({
      where: { id: parseInt(id) },
      include: { devices: true }
    });
    
    if (!building) {
      return res.status(404).json({ error: '楼栋不存在' });
    }
    
    if (building.devices.length > 0) {
      return res.status(400).json({ 
        error: '该楼栋下还有设备，无法删除',
        deviceCount: building.devices.length
      });
    }
    
    await prisma.building.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
