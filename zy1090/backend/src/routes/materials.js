import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { search, categoryId, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          _count: {
            select: { batches: true, recipeItems: true }
          }
        }
      }),
      prisma.material.count({ where })
    ]);

    res.json({
      data: materials,
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

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.materialCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { materials: true }
        }
      }
    });
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

router.get('/all', async (req, res, next) => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { name: 'asc' },
      include: { category: true }
    });
    res.json({ data: materials });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const material = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        batches: {
          orderBy: { createdAt: 'desc' },
          include: {
            supplier: true
          }
        },
        recipeItems: {
          include: {
            recipe: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    res.json({ data: material });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, categoryId, unit, allergens, description, note } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '材料名称不能为空' });
    }
    if (!unit || unit.trim() === '') {
      return res.status(400).json({ error: '请指定单位' });
    }

    const material = await prisma.material.create({
      data: {
        name: name.trim(),
        categoryId: categoryId ? parseInt(categoryId) : null,
        unit: unit.trim(),
        allergens,
        description,
        note
      },
      include: { category: true }
    });

    res.status(201).json({ data: material, message: '材料创建成功' });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '分类名称不能为空' });
    }

    const category = await prisma.materialCategory.create({
      data: {
        name: name.trim(),
        description
      }
    });

    res.status(201).json({ data: category, message: '分类创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, categoryId, unit, allergens, description, note } = req.body;

    const existing = await prisma.material.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: '材料不存在' });
    }

    const material = await prisma.material.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || existing.name,
        categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : existing.categoryId,
        unit: unit?.trim() || existing.unit,
        allergens: allergens !== undefined ? allergens : existing.allergens,
        description: description !== undefined ? description : existing.description,
        note: note !== undefined ? note : existing.note
      },
      include: { category: true }
    });

    res.json({ data: material, message: '材料更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { batches: true, recipeItems: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '材料不存在' });
    }

    if (existing._count.batches > 0 || existing._count.recipeItems > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该材料关联了 ${existing._count.batches} 个批次和 ${existing._count.recipeItems} 个配方项，请先处理关联数据`
      });
    }

    await prisma.material.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: '材料删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
