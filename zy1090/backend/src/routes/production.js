import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { dateUtils, unitUtils, calculateUtils, warningUtils, mapperUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { productId, status, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (productId) {
      where.productId = parseInt(productId);
    }
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [productions, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          recipe: true,
          materials: {
            include: {
              materialBatch: {
                include: {
                  material: true
                }
              }
            }
          },
          _count: {
            select: { materials: true, orderItems: true }
          }
        }
      }),
      prisma.productionBatch.count({ where })
    ]);

    const productionsWithCost = productions.map(prod => {
      const totalCost = prod.materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
      return {
        ...prod,
        totalCost,
        unitCost: prod.quantity > 0 ? totalCost / prod.quantity : 0
      };
    });

    res.json({
      data: mapperUtils.mapProductionBatchList(productionsWithCost),
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

router.get('/check-feasibility', async (req, res, next) => {
  try {
    const { recipeId, quantity } = req.query;

    if (!recipeId || !quantity) {
      return res.status(400).json({ error: '请提供配方ID和生产数量' });
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(recipeId) },
      include: {
        ingredients: {
          include: { material: true }
        },
        product: true
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: '配方不存在' });
    }

    const materialIds = recipe.ingredients.map(i => i.materialId);
    const materialBatches = await prisma.materialBatch.findMany({
      where: {
        materialId: { in: materialIds },
        status: 'active',
        remainingQuantity: { gt: 0 }
      },
      include: { material: true },
      orderBy: { expiryDate: 'asc' }
    });

    const feasibility = warningUtils.checkProductionFeasibility(
      recipe,
      materialBatches,
      parseFloat(quantity)
    );

    const materialAllocations = [];
    for (const ingredient of recipe.ingredients) {
      const requiredBase = ingredient.quantity * parseFloat(quantity);
      const requiredWithLoss = calculateUtils.calculateRequiredQuantity(requiredBase, ingredient.lossRate);
      
      const batches = materialBatches.filter(
        b => b.materialId === ingredient.materialId
      );
      
      const allocation = {
        materialId: ingredient.materialId,
        materialName: ingredient.material?.name,
        required: requiredWithLoss,
        unit: ingredient.unit,
        lossRate: ingredient.lossRate,
        availableBatches: batches.map(b => ({
          id: b.id,
          batchNumber: b.batchNumber,
          remainingQuantity: b.remainingQuantity,
          unit: b.unit,
          unitPrice: b.unitPrice,
          expiryDate: b.expiryDate,
          isExpired: dateUtils.isExpired(b.expiryDate),
          isExpiringSoon: dateUtils.isExpiringSoon(b.expiryDate, 30),
          warnings: warningUtils.checkMaterialBatch(b)
        }))
      };
      materialAllocations.push(allocation);
    }

    res.json({
      data: {
        feasible: feasibility.feasible,
        issues: feasibility.issues,
        requirements: feasibility.requirements,
        materialAllocations,
        recipe,
        quantity: parseFloat(quantity)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const production = await prisma.productionBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: true,
        recipe: {
          include: {
            ingredients: {
              include: { material: true }
            }
          }
        },
        materials: {
          include: {
            materialBatch: {
              include: {
                material: true,
                supplier: true
              }
            }
          },
          orderBy: { id: 'asc' }
        },
        orderItems: {
          include: {
            order: {
              include: { customer: true }
            }
          }
        }
      }
    });

    if (!production) {
      return res.status(404).json({ error: '生产批次不存在' });
    }

    const totalCost = production.materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    res.json({
      data: {
        ...production,
        totalCost,
        unitCost: production.quantity > 0 ? totalCost / production.quantity : 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, batchNumber, quantity, unit, recipeId, startDate, note, materialAllocations } = req.body;

    if (!productId) {
      return res.status(400).json({ error: '请选择产品' });
    }
    if (!batchNumber || batchNumber.trim() === '') {
      return res.status(400).json({ error: '请填写生产批次号' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '请输入有效的生产数量' });
    }
    if (!unit || unit.trim() === '') {
      return res.status(400).json({ error: '请指定单位' });
    }

    const existingBatch = await prisma.productionBatch.findFirst({
      where: { batchNumber: batchNumber.trim() }
    });

    if (existingBatch) {
      return res.status(400).json({ error: '生产批次号已存在' });
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(400).json({ error: '产品不存在' });
    }

    let recipe = null;
    if (recipeId) {
      recipe = await prisma.recipe.findUnique({
        where: { id: parseInt(recipeId) },
        include: {
          ingredients: {
            include: { material: true }
          }
        }
      });
      if (!recipe) {
        return res.status(400).json({ error: '配方不存在' });
      }
    }

    if (materialAllocations && !Array.isArray(materialAllocations)) {
      return res.status(400).json({ error: '材料分配格式错误' });
    }

    const issues = [];
    let totalProductionCost = 0;

    if (materialAllocations && materialAllocations.length > 0) {
      for (const alloc of materialAllocations) {
        const batch = await prisma.materialBatch.findUnique({
          where: { id: parseInt(alloc.materialBatchId) }
        });

        if (!batch) {
          issues.push({ type: 'error', message: `材料批次不存在: ${alloc.materialBatchId}` });
          continue;
        }

        if (batch.status !== 'active') {
          issues.push({ type: 'error', message: `批次 ${batch.batchNumber} 状态不是可用状态` });
          continue;
        }

        if (dateUtils.isExpired(batch.expiryDate)) {
          issues.push({ type: 'warning', message: `批次 ${batch.batchNumber} 已过期` });
        }

        if (alloc.quantity <= 0) {
          issues.push({ type: 'error', message: `用量必须大于 0` });
          continue;
        }

        const validation = unitUtils.validateUnits(alloc.unit, batch.unit);
        if (!validation.canConvert && alloc.unit !== batch.unit) {
          issues.push({ type: 'error', message: validation.message });
          continue;
        }

        let requiredQty = alloc.quantity;
        if (alloc.unit !== batch.unit) {
          const converted = unitUtils.convert(alloc.quantity, alloc.unit, batch.unit);
          if (converted === null) {
            issues.push({ type: 'error', message: `单位转换失败: ${alloc.unit} -> ${batch.unit}` });
            continue;
          }
          requiredQty = converted;
        }

        if (batch.remainingQuantity < requiredQty) {
          issues.push({ 
            type: 'error', 
            message: `批次 ${batch.batchNumber} 库存不足，需要 ${requiredQty} ${batch.unit}，实际剩余 ${batch.remainingQuantity} ${batch.unit}` 
          });
          continue;
        }

        const cost = requiredQty * batch.unitPrice;
        totalProductionCost += cost;
      }
    }

    const hasErrors = issues.some(i => i.type === 'error');
    if (hasErrors) {
      return res.status(400).json({ 
        error: '生产验证失败',
        issues 
      });
    }

    const production = await prisma.$transaction(async (tx) => {
      const newProduction = await tx.productionBatch.create({
        data: {
          productId: parseInt(productId),
          batchNumber: batchNumber.trim(),
          quantity: parseFloat(quantity),
          unit: unit.trim(),
          recipeId: recipeId ? parseInt(recipeId) : null,
          status: 'draft',
          startDate: startDate ? new Date(startDate) : null,
          note
        }
      });

      if (materialAllocations && materialAllocations.length > 0) {
        for (const alloc of materialAllocations) {
          const batch = await tx.materialBatch.findUnique({
            where: { id: parseInt(alloc.materialBatchId) }
          });

          if (!batch) continue;

          let usedQty = alloc.quantity;
          let usedUnit = alloc.unit;
          
          if (alloc.unit !== batch.unit) {
            const converted = unitUtils.convert(alloc.quantity, alloc.unit, batch.unit);
            if (converted !== null) {
              usedQty = converted;
              usedUnit = batch.unit;
            }
          }

          const totalCost = usedQty * batch.unitPrice;

          await tx.productionMaterial.create({
            data: {
              productionBatchId: newProduction.id,
              materialBatchId: parseInt(alloc.materialBatchId),
              quantity: usedQty,
              unit: usedUnit,
              unitPrice: batch.unitPrice,
              totalCost
            }
          });
        }
      }

      return tx.productionBatch.findUnique({
        where: { id: newProduction.id },
        include: {
          product: true,
          recipe: true,
          materials: {
            include: {
              materialBatch: {
                include: { material: true }
              }
            }
          }
        }
      });
    });

    res.status(201).json({ 
      data: {
        ...production,
        totalCost: totalProductionCost
      }, 
      message: '生产批次创建成功',
      warnings: issues.filter(i => i.type === 'warning')
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { endDate, note } = req.body;

    const production = await prisma.productionBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        materials: {
          include: {
            materialBatch: true
          }
        }
      }
    });

    if (!production) {
      return res.status(404).json({ error: '生产批次不存在' });
    }

    if (production.status === 'completed') {
      return res.status(400).json({ error: '该批次已经完成' });
    }

    if (production.materials.length === 0) {
      return res.status(400).json({ error: '请先分配材料' });
    }

    const issues = [];
    for (const pm of production.materials) {
      const batch = pm.materialBatch;
      
      if (batch.remainingQuantity < pm.quantity) {
        issues.push({
          type: 'error',
          message: `批次 ${batch.batchNumber} 库存不足，需要 ${pm.quantity} ${pm.unit}，实际剩余 ${batch.remainingQuantity} ${batch.unit}`
        });
      }

      if (dateUtils.isExpired(batch.expiryDate)) {
        issues.push({
          type: 'warning',
          message: `批次 ${batch.batchNumber} 已过期`
        });
      }
    }

    const hasErrors = issues.some(i => i.type === 'error');
    if (hasErrors) {
      return res.status(400).json({ 
        error: '无法完成生产',
        issues 
      });
    }

    const updatedProduction = await prisma.$transaction(async (tx) => {
      for (const pm of production.materials) {
        const batch = pm.materialBatch;
        const newRemaining = batch.remainingQuantity - pm.quantity;
        
        await tx.materialBatch.update({
          where: { id: batch.id },
          data: {
            remainingQuantity: newRemaining,
            status: newRemaining <= 0 ? 'used_up' : batch.status
          }
        });
      }

      return tx.productionBatch.update({
        where: { id: parseInt(id) },
        data: {
          status: 'completed',
          endDate: endDate ? new Date(endDate) : new Date(),
          note: note !== undefined ? note : production.note
        },
        include: {
          product: true,
          recipe: true,
          materials: {
            include: {
              materialBatch: {
                include: { material: true }
              }
            }
          }
        }
      });
    });

    const totalCost = updatedProduction.materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    res.json({ 
      data: {
        ...updatedProduction,
        totalCost,
        unitCost: updatedProduction.quantity > 0 ? totalCost / updatedProduction.quantity : 0
      }, 
      message: '生产完成，库存已扣减',
      warnings: issues
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { batchNumber, quantity, unit, startDate, note, status, materialAllocations } = req.body;

    const existing = await prisma.productionBatch.findUnique({
      where: { id: parseInt(id) },
      include: { materials: true }
    });

    if (!existing) {
      return res.status(404).json({ error: '生产批次不存在' });
    }

    if (existing.status === 'completed' && materialAllocations) {
      return res.status(400).json({ error: '已完成的生产批次不能修改材料分配' });
    }

    const production = await prisma.productionBatch.update({
      where: { id: parseInt(id) },
      data: {
        batchNumber: batchNumber?.trim() || existing.batchNumber,
        quantity: quantity !== undefined ? parseFloat(quantity) : existing.quantity,
        unit: unit?.trim() || existing.unit,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
        note: note !== undefined ? note : existing.note,
        status: status || existing.status
      },
      include: {
        product: true,
        recipe: true,
        materials: {
          include: {
            materialBatch: {
              include: { material: true }
            }
          }
        }
      }
    });

    const totalCost = production.materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    res.json({ 
      data: {
        ...production,
        totalCost,
        unitCost: production.quantity > 0 ? totalCost / production.quantity : 0
      }, 
      message: '生产批次更新成功' 
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.productionBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { orderItems: true, materials: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '生产批次不存在' });
    }

    if (existing._count.orderItems > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该批次已关联 ${existing._count.orderItems} 个订单`
      });
    }

    if (existing.status === 'completed') {
      return res.status(400).json({
        error: '无法删除',
        message: '已完成的生产批次无法删除（已扣减库存）'
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.productionMaterial.deleteMany({
        where: { productionBatchId: parseInt(id) }
      });
      await tx.productionBatch.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({ message: '生产批次删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
