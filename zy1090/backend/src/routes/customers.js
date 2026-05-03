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
        { phone: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { orders: true }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      data: customers,
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
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ data: customers });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }

    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, contact, phone, email, address, note } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '客户名称不能为空' });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        contact,
        phone,
        email,
        address,
        note
      }
    });

    res.status(201).json({ data: customer, message: '客户创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, contact, phone, email, address, note } = req.body;

    const existing = await prisma.customer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: '客户不存在' });
    }

    const customer = await prisma.customer.update({
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

    res.json({ data: customer, message: '客户更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '客户不存在' });
    }

    if (existing._count.orders > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该客户关联了 ${existing._count.orders} 个订单`
      });
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: '客户删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
