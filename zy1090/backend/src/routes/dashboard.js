import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { dateUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/overview', async (req, res, next) => {
  try {
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalMaterials,
      activeBatches,
      expiringSoon,
      lowStockBatches,
      totalProducts,
      totalRecipes,
      totalOrders,
      negativeMarginOrders,
      totalProduction,
      totalCustomers
    ] = await Promise.all([
      prisma.material.count(),
      prisma.materialBatch.count({ where: { status: 'active' } }),
      prisma.materialBatch.findMany({
        where: {
          status: 'active',
          expiryDate: {
            gte: now,
            lte: threeMonthsLater
          },
          remainingQuantity: { gt: 0 }
        },
        include: {
          material: true,
          supplier: true
        },
        orderBy: { expiryDate: 'asc' }
      }),
      prisma.materialBatch.findMany({
        where: {
          status: 'active',
          remainingQuantity: { gt: 0 }
        },
        include: {
          material: true
        }
      }),
      prisma.product.count(),
      prisma.recipe.count(),
      prisma.order.count(),
      prisma.order.count({ where: { profit: { lt: 0 } } }),
      prisma.productionBatch.count(),
      prisma.customer.count()
    ]);

    const lowStock = lowStockBatches.filter(
      b => b.remainingQuantity > 0 && b.remainingQuantity < b.quantity * 0.2
    );

    const criticalExpiring = expiringSoon.filter(
      b => dateUtils.isExpiringSoon(b.expiryDate, 30)
    );

    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: true }
    });

    const recentProduction = await prisma.productionBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { product: true }
    });

    res.json({
      data: {
        statistics: {
          materials: totalMaterials,
          activeBatches,
          products: totalProducts,
          recipes: totalRecipes,
          orders: totalOrders,
          production: totalProduction,
          customers: totalCustomers
        },
        risks: {
          expiringSoon: {
            count: expiringSoon.length,
            critical: criticalExpiring.length,
            items: expiringSoon.map(b => ({
              ...b,
              daysUntilExpiry: dateUtils.getDaysUntilExpiry(b.expiryDate)
            }))
          },
          lowStock: {
            count: lowStock.length,
            items: lowStock.map(b => ({
              ...b,
              percentage: (b.remainingQuantity / b.quantity) * 100
            }))
          },
          negativeMarginOrders: {
            count: negativeMarginOrders
          }
        },
        recentOrders,
        recentProduction
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/expiring', async (req, res, next) => {
  try {
    const { days = 90, page = 1, limit = 20 } = req.query;
    
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

    const where = {
      status: 'active',
      expiryDate: {
        gte: now,
        lte: expiryThreshold
      },
      remainingQuantity: { gt: 0 }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [batches, total] = await Promise.all([
      prisma.materialBatch.findMany({
        where,
        skip,
        take,
        orderBy: { expiryDate: 'asc' },
        include: {
          material: {
            include: { category: true }
          },
          supplier: true,
          usages: {
            include: {
              productionBatch: {
                include: {
                  product: true,
                  orderItems: {
                    include: {
                      order: {
                        include: { customer: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.materialBatch.count({ where })
    ]);

    const batchesWithDetails = batches.map(batch => ({
      ...batch,
      daysUntilExpiry: dateUtils.getDaysUntilExpiry(batch.expiryDate),
      isCritical: dateUtils.isExpiringSoon(batch.expiryDate, 30),
      affectedProduction: batch.usages.length,
      affectedOrders: batch.usages.reduce((sum, u) => sum + (u.productionBatch?.orderItems?.length || 0), 0)
    }));

    res.json({
      data: batchesWithDetails,
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

router.get('/low-stock', async (req, res, next) => {
  try {
    const { threshold = 20, page = 1, limit = 20 } = req.query;
    
    const thresholdRatio = parseInt(threshold) / 100;

    const allBatches = await prisma.materialBatch.findMany({
      where: {
        status: 'active',
        remainingQuantity: { gt: 0 }
      },
      include: {
        material: {
          include: { category: true }
        },
        supplier: true
      },
      orderBy: { remainingQuantity: 'asc' }
    });

    const lowStockBatches = allBatches.filter(
      b => b.remainingQuantity < b.quantity * thresholdRatio
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const paginated = lowStockBatches.slice(skip, skip + take);

    const batchesWithDetails = paginated.map(batch => ({
      ...batch,
      percentage: (batch.remainingQuantity / batch.quantity) * 100,
      isCritical: batch.remainingQuantity < batch.quantity * 0.1
    }));

    res.json({
      data: batchesWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: lowStockBatches.length,
        totalPages: Math.ceil(lowStockBatches.length / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/negative-margin', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const where = {
      profit: { lt: 0 }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { profit: 'asc' },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              productionBatch: true
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    const totalLoss = orders.reduce((sum, o) => sum + Math.abs(o.profit || 0), 0);

    res.json({
      data: orders,
      summary: {
        totalLoss,
        averageLoss: orders.length > 0 ? totalLoss / orders.length : 0
      },
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

router.get('/trace-material-batch/:id', async (req, res, next) => {
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
                      include: { customer: true }
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
    const totalQuantityProduced = 0;
    const totalOrderValue = 0;

    for (const usage of batch.usages) {
      const production = usage.productionBatch;
      if (!production) continue;

      affectedProduction.push({
        id: production.id,
        batchNumber: production.batchNumber,
        productId: production.productId,
        productName: production.product?.name,
        quantity: production.quantity,
        unit: production.unit,
        status: production.status,
        materialUsed: usage.quantity,
        materialUnit: usage.unit,
        materialCost: usage.totalCost,
        startDate: production.startDate,
        endDate: production.endDate
      });

      for (const orderItem of production.orderItems) {
        const order = orderItem.order;
        if (!order) continue;

        affectedOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerId: order.customerId,
          customerName: order.customer?.name,
          customerContact: order.customer?.phone || order.customer?.email,
          quantity: orderItem.quantity,
          totalPrice: order.totalPrice,
          profit: order.profit,
          createdAt: order.createdAt
        });

        if (order.customerId) {
          affectedCustomers.add(order.customerId);
        }
      }
    }

    const traceResult = {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        materialId: batch.materialId,
        materialName: batch.material?.name,
        supplierName: batch.supplier?.name,
        totalQuantity: batch.quantity,
        remainingQuantity: batch.remainingQuantity,
        usedQuantity: batch.quantity - batch.remainingQuantity,
        unit: batch.unit,
        unitPrice: batch.unitPrice,
        totalPrice: batch.totalPrice,
        expiryDate: batch.expiryDate,
        allergens: batch.allergens,
        status: batch.status,
        daysUntilExpiry: dateUtils.getDaysUntilExpiry(batch.expiryDate),
        isExpired: dateUtils.isExpired(batch.expiryDate),
        isExpiringSoon: dateUtils.isExpiringSoon(batch.expiryDate, 30)
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
      },
      recallImpact: {
        needsRecall: dateUtils.isExpired(batch.expiryDate) || batch.status === 'recalled',
        reason: dateUtils.isExpired(batch.expiryDate) ? '材料已过期' : (batch.status === 'recalled' ? '主动召回' : null),
        affectedOrdersCount: affectedOrders.length,
        affectedCustomersCount: affectedCustomers.size
      }
    };

    res.json({ data: traceResult });
  } catch (error) {
    next(error);
  }
});

export default router;
