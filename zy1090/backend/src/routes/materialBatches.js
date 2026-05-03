import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { dateUtils, warningUtils, mapperUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { 
      search, 
      materialId, 
      supplierId, 
      status,
      isExpiring, 
      isLowStock,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { batchNumber: { contains: search } },
        { note: { contains: search } },
        { material: { name: { contains: search } } }
      ];
    }
    if (materialId) {
      where.materialId = parseInt(materialId);
    }
    if (supplierId) {
      where.supplierId = parseInt(supplierId);
    }
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let batches = await prisma.materialBatch.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        material: {
          include: { category: true }
        },
        supplier: true,
        usages: {
          include: {
            productionBatch: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (isExpiring === 'true') {
      batches = batches.filter(b => dateUtils.isExpiringSoon(b.expiryDate, 90));
    }
    if (isLowStock === 'true') {
      batches = batches.filter(b => b.remainingQuantity > 0 && b.remainingQuantity < b.quantity * 0.2);
    }

    batches = batches.map(batch => ({
      ...batch,
      warnings: warningUtils.checkMaterialBatch(batch),
      daysUntilExpiry: dateUtils.getDaysUntilExpiry(batch.expiryDate)
    }));

    const total = await prisma.materialBatch.count({ where });

    res.json({
      data: mapperUtils.mapMaterialBatchList(batches),
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

router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [totalBatches, activeBatches, expiringBatches, expiredBatches] = await Promise.all([
      prisma.materialBatch.count(),
      prisma.materialBatch.count({ where: { status: 'active' } }),
      prisma.materialBatch.count({
        where: {
          status: 'active',
          expiryDate: {
            gte: now,
            lte: threeMonthsLater
          }
        }
      }),
      prisma.materialBatch.count({
        where: {
          status: 'active',
          expiryDate: {
            lt: now
          }
        }
      })
    ]);

    const lowStockBatches = await prisma.materialBatch.findMany({
      where: {
        status: 'active',
        remainingQuantity: { gt: 0 }
      },
      include: { material: true }
    });

    const lowStockCount = lowStockBatches.filter(
      b => b.remainingQuantity < b.quantity * 0.2
    ).length;

    res.json({
      data: {
        total: totalBatches,
        active: activeBatches,
        expiring: expiringBatches,
        expired: expiredBatches,
        lowStock: lowStockCount
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/trace/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const batch = await prisma.materialBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        material: true,
        supplier: true,
        usages: {
          include: {
            productionBatch: {
              include: {
                product: true,
                orderItems: {
                  include: {
                    order: {
                      include: {
                        customer: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: '材料批次不存在' });
    }

    const affectedProduction = [];
    const affectedOrders = [];
    const affectedCustomers = new Set();

    for (const usage of batch.usages) {
      const production = usage.productionBatch;
      affectedProduction.push({
        id: production.id,
        batchNumber: production.batchNumber,
        productName: production.product?.name,
        quantity: production.quantity,
        unit: production.unit,
        status: production.status,
        quantityUsed: usage.quantity,
        totalCost: usage.totalCost
      });

      for (const orderItem of production.orderItems) {
        const order = orderItem.order;
        affectedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customer?.name,
          quantity: orderItem.quantity,
          totalPrice: order.totalPrice,
          profit: order.profit
        });
        if (order.customer) {
          affectedCustomers.add(order.customer.id);
        }
      }
    }

    const traceResult = {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        materialName: batch.material?.name,
        quantity: batch.quantity,
        remainingQuantity: batch.remainingQuantity,
        unit: batch.unit,
        unitPrice: batch.unitPrice,
        expiryDate: batch.expiryDate,
        status: batch.status,
        supplier: batch.supplier?.name
      },
      affectedProduction,
      affectedOrders,
      affectedCustomerCount: affectedCustomers.size,
      summary: {
        totalProductionAffected: affectedProduction.length,
        totalOrdersAffected: affectedOrders.length,
        totalCustomersAffected: affectedCustomers.size,
        totalQuantityProduced: affectedProduction.reduce((sum, p) => sum + p.quantity, 0),
        totalOrderValue: affectedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
      }
    };

    res.json({ data: mapperUtils.mapTraceResult(traceResult) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const batch = await prisma.materialBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        material: {
          include: { category: true }
        },
        supplier: true,
        usages: {
          include: {
            productionBatch: {
              include: {
                product: true
              }
            }
          },
          orderBy: { id: 'desc' }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: '材料批次不存在' });
    }

    res.json({
      data: {
        ...mapperUtils.mapMaterialBatch(batch),
        warnings: warningUtils.checkMaterialBatch(batch),
        daysUntilExpiry: dateUtils.getDaysUntilExpiry(batch.expiryDate)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const materialId = body.materialId;
    const supplierId = body.supplierId;
    const batchNumber = body.batchNumber || body.batchNo;
    const quantity = body.quantity !== undefined ? body.quantity : body.originalQuantity;
    const unitPrice = body.unitPrice !== undefined ? body.unitPrice : body.unitCost;
    const totalPrice = body.totalPrice;
    const unit = body.unit;
    const receivedDate = body.receivedDate || body.purchaseDate;
    const expiryDate = body.expiryDate;
    const allergensRaw = body.allergens;
    const note = body.note || body.remarks;

    const allergens = Array.isArray(allergensRaw) ? allergensRaw.join(',') : allergensRaw;

    if (!materialId) {
      return res.status(400).json({ error: '请选择材料' });
    }
    if (!batchNumber || String(batchNumber).trim() === '') {
      return res.status(400).json({ error: '请填写批次号' });
    }
    if (quantity === undefined || quantity === null || quantity <= 0) {
      return res.status(400).json({ error: '请填写有效的入库数量' });
    }
    if (!unit || String(unit).trim() === '') {
      return res.status(400).json({ error: '请指定单位' });
    }

    const existingBatch = await prisma.materialBatch.findFirst({
      where: { batchNumber: String(batchNumber).trim() }
    });

    if (existingBatch) {
      return res.status(400).json({ error: '批次号已存在' });
    }

    const material = await prisma.material.findUnique({
      where: { id: parseInt(materialId) }
    });

    if (!material) {
      return res.status(400).json({ error: '材料不存在' });
    }

    const batch = await prisma.materialBatch.create({
      data: {
        materialId: parseInt(materialId),
        supplierId: supplierId ? parseInt(supplierId) : null,
        batchNumber: String(batchNumber).trim(),
        quantity: parseFloat(quantity),
        remainingQuantity: parseFloat(quantity),
        unitPrice: unitPrice ? parseFloat(unitPrice) : 0,
        totalPrice: totalPrice ? parseFloat(totalPrice) : (quantity * (unitPrice || 0)),
        unit: String(unit).trim(),
        receivedDate: receivedDate ? new Date(receivedDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        allergens: allergens || material.allergens,
        note,
        status: 'active'
      },
      include: {
        material: true,
        supplier: true
      }
    });

    res.status(201).json({ data: mapperUtils.mapMaterialBatch(batch), message: '材料批次创建成功' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.materialBatch.findUnique({
      where: { id: parseInt(id) },
      include: { material: true }
    });

    if (!existing) {
      return res.status(404).json({ error: '材料批次不存在' });
    }

    const supplierId = body.supplierId;
    const batchNumber = body.batchNumber || body.batchNo;
    const quantity = body.quantity !== undefined ? body.quantity : body.originalQuantity;
    const unitPrice = body.unitPrice !== undefined ? body.unitPrice : body.unitCost;
    const totalPrice = body.totalPrice;
    const unit = body.unit;
    const receivedDate = body.receivedDate || body.purchaseDate;
    const expiryDate = body.expiryDate;
    const allergensRaw = body.allergens;
    const note = body.note || body.remarks;
    const status = body.status;

    const allergens = Array.isArray(allergensRaw) ? allergensRaw.join(',') : allergensRaw;

    if (batchNumber && String(batchNumber).trim() !== existing.batchNumber) {
      const duplicate = await prisma.materialBatch.findFirst({
        where: { batchNumber: String(batchNumber).trim() }
      });
      if (duplicate) {
        return res.status(400).json({ error: '批次号已存在' });
      }
    }

    const batch = await prisma.materialBatch.update({
      where: { id: parseInt(id) },
      data: {
        supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId) : null) : existing.supplierId,
        batchNumber: batchNumber !== undefined ? String(batchNumber).trim() : existing.batchNumber,
        quantity: quantity !== undefined ? parseFloat(quantity) : existing.quantity,
        unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : existing.unitPrice,
        totalPrice: totalPrice !== undefined ? parseFloat(totalPrice) : existing.totalPrice,
        unit: unit !== undefined ? String(unit).trim() : existing.unit,
        receivedDate: receivedDate !== undefined ? (receivedDate ? new Date(receivedDate) : null) : existing.receivedDate,
        expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : existing.expiryDate,
        allergens: allergens !== undefined ? allergens : existing.allergens,
        note: note !== undefined ? note : existing.note,
        status: status || existing.status
      },
      include: {
        material: true,
        supplier: true
      }
    });

    res.json({ data: mapperUtils.mapMaterialBatch(batch), message: '材料批次更新成功' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.materialBatch.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { usages: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: '材料批次不存在' });
    }

    if (existing._count.usages > 0) {
      return res.status(400).json({
        error: '无法删除',
        message: `该批次已被 ${existing._count.usages} 个生产记录使用，无法删除`
      });
    }

    await prisma.materialBatch.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: '材料批次删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
