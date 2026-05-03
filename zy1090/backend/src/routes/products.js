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
        { sku: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { recipes: true, production: true, orderItems: true }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      data: products,
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
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        recipes: {
          where: { isDefault: true }
        }
      }
    });
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        recipes: {
          include: {
            ingredients: {
              include: {
                material: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          },
          orderBy: { isDefault: 'desc' }
        },
        production: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        orderItems: {
          include: {
            order: true
          },
          orderBy: { id: 'desc' },
          take: 10
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }

    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, sku, description, basePrice, note } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '产品名称不能为空' });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: sku?.trim() || null,
        description,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        note
      }
    });

    res.status(201).json({ data: product, message: '产品创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, description, basePrice, note } = req.body;

    const existing = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: '产品不存在' });
    }

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || existing.name,
        sku: sku !== undefined ? (sku?.trim() || null) : existing.sku,
        description: description !== undefined ? description : existing.description,
        basePrice: basePrice !== undefined ? (basePrice ? parseFloat(basePrice) : null) : existing.basePrice,
        note: note !== undefined ? note : existing.note
      }
    });

    res.json({ data: product, message: '产品更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { recipes: true, production: true, orderItems: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '产品不存在' });
    }

    if (existing._count.production > 0 || existing._count.orderItems > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该产品关联了 ${existing._count.production} 个生产批次和 ${existing._count.orderItems} 个订单`
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({
        where: {
          recipe: {
            productId: parseInt(id)
          }
        }
      });
      await tx.recipe.deleteMany({
        where: { productId: parseInt(id) }
      });
      await tx.product.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({ message: '产品删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
