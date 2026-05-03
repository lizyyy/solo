import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { unitUtils, calculateUtils, mapperUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { productId, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (productId) {
      where.productId = parseInt(productId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        skip,
        take,
        orderBy: { isDefault: 'desc' },
        include: {
          product: true,
          ingredients: {
            include: {
              material: true
            },
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { ingredients: true }
          }
        }
      }),
      prisma.recipe.count({ where })
    ]);

    const recipesWithCost = recipes.map(recipe => {
      let estimatedCost = 0;
      for (const ingredient of recipe.ingredients) {
        estimatedCost += calculateUtils.calculateCostWithLoss(
          ingredient.quantity,
          0,
          ingredient.lossRate
        );
      }
      return {
        ...recipe,
        estimatedCostPerUnit: estimatedCost
      };
    });

    res.json({
      data: mapperUtils.mapRecipeList(recipesWithCost),
      total,
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

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: true,
        ingredients: {
          include: {
            material: true
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: '配方不存在' });
    }

    res.json({ data: mapperUtils.mapRecipe(recipe) });
  } catch (error) {
    next(error);
  }
});

router.post('/validate-ingredient', async (req, res, next) => {
  try {
    const body = req.body;
    const materialId = body.materialId;
    const quantity = body.quantity;
    const unit = body.unit;
    const lossRate = body.lossRate !== undefined ? body.lossRate : body.wasteRate;

    if (!materialId) {
      return res.status(400).json({ error: '请选择材料' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '请输入有效的用量' });
    }
    if (!unit || unit.trim() === '') {
      return res.status(400).json({ error: '请指定单位' });
    }
    if (lossRate !== undefined && (lossRate < 0 || lossRate > 100)) {
      return res.status(400).json({ error: '损耗率应在 0-100 之间' });
    }

    const material = await prisma.material.findUnique({
      where: { id: parseInt(materialId) }
    });

    if (!material) {
      return res.status(400).json({ error: '材料不存在' });
    }

    const unitValidation = unitUtils.validateUnits(unit, material.unit);
    
    const requiredWithLoss = calculateUtils.calculateRequiredQuantity(
      quantity,
      lossRate || 0
    );

    res.json({
      valid: true,
      material,
      unitValidation,
      requiredWithLoss,
      wasteRate: lossRate,
      message: unitValidation.message
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const productId = body.productId;
    const name = body.name;
    const version = body.version;
    const description = body.description;
    const yieldAmount = body.yield;
    const yieldUnit = body.yieldUnit;
    const isDefault = body.isDefault !== undefined ? body.isDefault : body.isActive;
    const note = body.note || body.remarks;
    const ingredients = body.ingredients;

    if (!productId) {
      return res.status(400).json({ error: '请选择产品' });
    }
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '配方名称不能为空' });
    }
    if (!yieldAmount || yieldAmount <= 0) {
      return res.status(400).json({ error: '请输入有效的产出数量' });
    }
    if (!yieldUnit || yieldUnit.trim() === '') {
      return res.status(400).json({ error: '请指定产出单位' });
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(400).json({ error: '产品不存在' });
    }

    if (ingredients && !Array.isArray(ingredients)) {
      return res.status(400).json({ error: '配方成分格式错误' });
    }

    if (isDefault) {
      await prisma.recipe.updateMany({
        where: { productId: parseInt(productId) },
        data: { isDefault: false }
      });
    }

    const recipe = await prisma.$transaction(async (tx) => {
      const newRecipe = await tx.recipe.create({
        data: {
          productId: parseInt(productId),
          name: name.trim(),
          version: version || 'v1.0',
          description,
          yield: parseFloat(yieldAmount),
          yieldUnit: yieldUnit.trim(),
          isDefault: !!isDefault,
          note
        }
      });

      if (ingredients && ingredients.length > 0) {
        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          
          if (!ing.materialId || !ing.quantity || !ing.unit) {
            continue;
          }

          const material = await tx.material.findUnique({
            where: { id: parseInt(ing.materialId) }
          });

          if (!material) continue;

          const lossRate = ing.lossRate !== undefined ? ing.lossRate : ing.wasteRate;
          const note = ing.note || ing.remarks;

          await tx.recipeIngredient.create({
            data: {
              recipeId: newRecipe.id,
              materialId: parseInt(ing.materialId),
              quantity: parseFloat(ing.quantity),
              unit: ing.unit.trim(),
              lossRate: lossRate !== undefined ? parseFloat(lossRate) : 0,
              note,
              sortOrder: ing.sortOrder !== undefined ? parseInt(ing.sortOrder) : i
            }
          });
        }
      }

      return tx.recipe.findUnique({
        where: { id: newRecipe.id },
        include: {
          product: true,
          ingredients: {
            include: { material: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });

    res.status(201).json({ data: mapperUtils.mapRecipe(recipe), message: '配方创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.recipe.findUnique({
      where: { id: parseInt(id) },
      include: { ingredients: true }
    });

    if (!existing) {
      return res.status(404).json({ error: '配方不存在' });
    }

    const name = body.name;
    const version = body.version;
    const description = body.description;
    const yieldAmount = body.yield;
    const yieldUnit = body.yieldUnit;
    const isDefault = body.isDefault !== undefined ? body.isDefault : body.isActive;
    const note = body.note || body.remarks;
    const ingredients = body.ingredients;

    if (isDefault && !existing.isDefault) {
      await prisma.recipe.updateMany({
        where: { productId: existing.productId },
        data: { isDefault: false }
      });
    }

    const recipe = await prisma.$transaction(async (tx) => {
      const updatedRecipe = await tx.recipe.update({
        where: { id: parseInt(id) },
        data: {
          name: name?.trim() || existing.name,
          version: version || existing.version,
          description: description !== undefined ? description : existing.description,
          yield: yieldAmount !== undefined ? parseFloat(yieldAmount) : existing.yield,
          yieldUnit: yieldUnit?.trim() || existing.yieldUnit,
          isDefault: isDefault !== undefined ? !!isDefault : existing.isDefault,
          note: note !== undefined ? note : existing.note
        }
      });

      if (ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: parseInt(id) }
        });

        if (Array.isArray(ingredients) && ingredients.length > 0) {
          for (let i = 0; i < ingredients.length; i++) {
            const ing = ingredients[i];
            
            if (!ing.materialId || !ing.quantity || !ing.unit) {
              continue;
            }

            const lossRate = ing.lossRate !== undefined ? ing.lossRate : ing.wasteRate;
            const note = ing.note || ing.remarks;

            await tx.recipeIngredient.create({
              data: {
                recipeId: updatedRecipe.id,
                materialId: parseInt(ing.materialId),
                quantity: parseFloat(ing.quantity),
                unit: ing.unit.trim(),
                lossRate: lossRate !== undefined ? parseFloat(lossRate) : 0,
                note,
                sortOrder: ing.sortOrder !== undefined ? parseInt(ing.sortOrder) : i
              }
            });
          }
        }
      }

      return tx.recipe.findUnique({
        where: { id: updatedRecipe.id },
        include: {
          product: true,
          ingredients: {
            include: { material: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });

    res.json({ data: mapperUtils.mapRecipe(recipe), message: '配方更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.recipe.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { ingredients: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '配方不存在' });
    }

    const usedInProduction = await prisma.productionBatch.count({
      where: { recipeId: parseInt(id) }
    });

    if (usedInProduction > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该配方已被 ${usedInProduction} 个生产批次使用`
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({
        where: { recipeId: parseInt(id) }
      });
      await tx.recipe.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({ message: '配方删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
