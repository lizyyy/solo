import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contact: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { materialBatches: true }
          }
        }
      }),
      prisma.supplier.count({ where })
    ]);

    res.json({
      data: suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/all', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ data: suppliers });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
      include: {
        materialBatches: {
          include: {
            material: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    res.json({ data: supplier });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, phone, email, address, note } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '供应商名称不能为空' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contact,
        phone,
        email,
        address,
        note
      }
    });

    res.status(201).json({ data: supplier, message: '供应商创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, contact, phone, email, address, note } = req.body;

    const existing = await prisma.supplier.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || existing.name,
        contact,
        phone,
        email,
        address,
        note
      }
    });

    res.json({ data: supplier, message: '供应商更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { materialBatches: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    if (existing._count.materialBatches > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该供应商关联了 ${existing._count.materialBatches} 个材料批次，请先处理关联数据`
      });
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: '供应商删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
