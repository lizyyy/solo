import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';

const router = Router();

const parseSkills = (worker) => {
  if (!worker) return worker;
  let skills = [];
  if (typeof worker.skills === 'string') {
    try {
      skills = JSON.parse(worker.skills);
    } catch {
      skills = [];
    }
  } else if (Array.isArray(worker.skills)) {
    skills = worker.skills;
  }
  return { ...worker, skills };
};

router.get('/', async (req, res, next) => {
  try {
    const { skill } = req.query;
    
    let workers = await prisma.worker.findMany({
      include: {
        _count: {
          select: { 
            repairOrders: {
              where: {
                status: { in: ['in_progress', 'pending_review'] }
              }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    workers = workers.map(parseSkills);
    
    if (skill) {
      workers = workers.filter(w => w.skills.includes(skill));
    }
    
    res.json(workers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let worker = await prisma.worker.findUnique({
      where: { id: parseInt(id) },
      include: {
        repairOrders: {
          include: {
            device: {
              include: { building: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!worker) {
      return res.status(404).json({ error: '维修师傅不存在' });
    }
    
    worker = parseSkills(worker);
    
    res.json(worker);
  } catch (error) {
    next(error);
  }
});

router.post('/',
  [
    body('name').notEmpty().withMessage('师傅姓名不能为空'),
    body('skills').isArray({ min: 1 }).withMessage('技能标签不能为空数组'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { name, phone, skills } = req.body;
      
      let worker = await prisma.worker.create({
        data: {
          name,
          phone,
          skills: JSON.stringify(skills)
        }
      });
      
      worker = parseSkills(worker);
      
      res.status(201).json(worker);
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  [
    body('name').notEmpty().withMessage('师傅姓名不能为空'),
    body('skills').isArray({ min: 1 }).withMessage('技能标签不能为空数组'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { name, phone, skills } = req.body;
      
      const existing = await prisma.worker.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existing) {
        return res.status(404).json({ error: '维修师傅不存在' });
      }
      
      let worker = await prisma.worker.update({
        where: { id: parseInt(id) },
        data: {
          name,
          phone,
          skills: JSON.stringify(skills)
        }
      });
      
      worker = parseSkills(worker);
      
      res.json(worker);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const worker = await prisma.worker.findUnique({
      where: { id: parseInt(id) },
      include: { 
        repairOrders: {
          where: {
            status: { in: ['in_progress', 'pending_review'] }
          }
        }
      }
    });
    
    if (!worker) {
      return res.status(404).json({ error: '维修师傅不存在' });
    }
    
    if (worker.repairOrders.length > 0) {
      return res.status(400).json({ 
        error: '该师傅还有未完成的维修单，无法删除',
        pendingCount: worker.repairOrders.length
      });
    }
    
    await prisma.worker.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
