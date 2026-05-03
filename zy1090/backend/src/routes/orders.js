import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateUtils, warningUtils, mapperUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res, next) => {
  try {
    const { customerId, status, isNegativeMargin, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (customerId) {
      where.customerId = parseInt(customerId);
    }
    if (status) {
      where.status = status;
    }

    let orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            productionBatch: true
          }
        },
        _count: {
          select: { items: true }
        }
      }
    });

    if (isNegativeMargin === 'true') {
      orders = orders.filter(o => o.profit !== null && o.profit < 0);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const paginatedOrders = orders.slice(skip, skip + take);

    const mappedOrders = mapperUtils.mapOrderList(paginatedOrders);
    const ordersWithWarnings = mappedOrders.map((order, index) => ({
      ...order,
      warnings: warningUtils.checkOrder(paginatedOrders[index])
    }));

    res.json({
      data: ordersWithWarnings,
      total: orders.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.length,
        totalPages: Math.ceil(orders.length / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [totalOrders, negativeMarginOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          profit: { lt: 0 }
        }
      })
    ]);

    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: true }
    });

    res.json({
      data: {
        total: totalOrders,
        negativeMargin: negativeMarginOrders,
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            productionBatch: {
              include: {
                materials: {
                  include: {
                    materialBatch: {
                      include: {
                        material: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { id: 'asc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json({
      data: {
        ...mapperUtils.mapOrder(order),
        warnings: warningUtils.checkOrder(order)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/calculate-quote', async (req, res, next) => {
  try {
    const { customerId, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请至少添加一个订单项' });
    }

    const quoteItems = [];
    let totalCost = 0;
    let totalPrice = 0;
    const warnings = [];

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        warnings.push({ type: 'error', message: '数量必须大于 0' });
        continue;
      }

      let unitCost = item.unitCost || 0;
      let productName = item.productName || '未知产品';

      if (item.productionBatchId) {
        const production = await prisma.productionBatch.findUnique({
          where: { id: parseInt(item.productionBatchId) },
          include: {
            product: true,
            materials: true
          }
        });

        if (production) {
          const prodTotalCost = production.materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
          unitCost = production.quantity > 0 ? prodTotalCost / production.quantity : 0;
          productName = production.product?.name || productName;
        }
      } else if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: parseInt(item.productId) }
        });
        if (product) {
          productName = product.name;
        }
      }

      const itemTotalCost = unitCost * item.quantity;
      const itemUnitPrice = item.unitPrice || (itemTotalCost * 1.5);
      const itemTotalPrice = itemUnitPrice * item.quantity;
      const itemProfit = itemTotalPrice - itemTotalCost;

      if (itemProfit < 0) {
        warnings.push({
          type: 'warning',
          severity: 'danger',
          message: `${productName} 报价亏损 ${Math.abs(itemProfit).toFixed(2)} 元`,
          item: productName
        });
      }

      totalCost += itemTotalCost;
      totalPrice += itemTotalPrice;

      quoteItems.push({
        ...item,
        productName,
        unitCost,
        unitPrice: itemUnitPrice,
        totalCost: itemTotalCost,
        totalPrice: itemTotalPrice,
        profit: itemProfit,
        profitMargin: itemTotalPrice > 0 ? (itemProfit / itemTotalPrice) * 100 : 0
      });
    }

    const profit = totalPrice - totalCost;
    const profitMargin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

    if (profit < 0) {
      warnings.unshift({
        type: 'negative_margin',
        severity: 'danger',
        message: `整体报价亏损 ${Math.abs(profit).toFixed(2)} 元`,
        profit,
        profitMargin
      });
    } else if (profitMargin < 10) {
      warnings.unshift({
        type: 'low_margin',
        severity: 'warning',
        message: `利润率过低 (${profitMargin.toFixed(2)}%)`,
        profitMargin
      });
    }

    res.json({
      data: {
        items: quoteItems.map(item => ({
          ...item,
          estimatedCost: item.unitCost,
          suggestedPrice: item.unitCost * 1.5
        })),
        totalEstimatedCost: totalCost,
        totalPrice,
        totalAmount: totalPrice,
        profit,
        profitMargin,
        suggestedPrice: totalCost * 1.5,
        suggestedMargin: 33.33,
        suggestedDetails: quoteItems.map(item => ({
          ...item,
          suggestedPrice: item.unitCost * 1.5,
          estimatedCost: item.unitCost
        }))
      },
      warnings
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const customerId = body.customerId;
    const orderNumber = body.orderNumber || body.orderNo;
    const status = body.status;
    const note = body.note || body.remarks;
    const items = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请至少添加一个订单项' });
    }

    let calculatedTotalCost = 0;
    let calculatedTotalPrice = 0;

    for (const item of items) {
      const itemTotalCost = item.totalCost || (item.unitCost || 0) * (item.quantity || 0);
      const itemTotalPrice = item.totalPrice || item.totalAmount || (item.unitPrice || 0) * (item.quantity || 0);
      calculatedTotalCost += itemTotalCost;
      calculatedTotalPrice += itemTotalPrice;
    }

    const profit = calculateUtils.calculateProfit(calculatedTotalPrice, calculatedTotalCost);
    const profitMargin = calculateUtils.calculateProfitMargin(calculatedTotalPrice, calculatedTotalCost);

    const now = new Date();
    let actualOrderNumber = orderNumber;
    if (!actualOrderNumber) {
      const count = await prisma.order.count() + 1;
      actualOrderNumber = `ORD-${now.getFullYear()}-${String(count).padStart(3, '0')}`;
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: actualOrderNumber,
          customerId: customerId ? parseInt(customerId) : null,
          status: status || 'draft',
          totalCost: calculatedTotalCost,
          totalPrice: calculatedTotalPrice,
          profit,
          profitMargin,
          note,
          quotedAt: status === 'quoted' ? now : null,
          confirmedAt: status === 'confirmed' ? now : null,
          completedAt: status === 'completed' ? now : null
        }
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemTotalCost = item.totalCost || (item.unitCost || 0) * (item.quantity || 0);
        const itemTotalPrice = item.totalPrice || item.totalAmount || (item.unitPrice || 0) * (item.quantity || 0);
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId ? parseInt(item.productId) : null,
            productionBatchId: item.productionBatchId ? parseInt(item.productionBatchId) : null,
            productName: item.productName || '未知产品',
            quantity: parseFloat(item.quantity),
            unit: item.unit || '个',
            unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
            totalCost: itemTotalCost,
            totalPrice: itemTotalPrice,
            profit: itemTotalPrice - itemTotalCost,
            note: item.note || item.remarks
          }
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              productionBatch: true
            }
          }
        }
      });
    });

    const warnings = warningUtils.checkOrder(order);

    res.status(201).json({ 
      data: mapperUtils.mapOrder(order), 
      message: '订单创建成功',
      warnings
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!existing) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const customerId = body.customerId;
    const orderNumber = body.orderNumber || body.orderNo;
    const status = body.status;
    const note = body.note || body.remarks;
    const items = body.items;

    const now = new Date();
    const updateData = {
      customerId: customerId !== undefined ? (customerId ? parseInt(customerId) : null) : existing.customerId,
      orderNumber: orderNumber !== undefined ? String(orderNumber).trim() : existing.orderNumber,
      status: status || existing.status,
      note: note !== undefined ? note : existing.note
    };

    if (status === 'quoted' && !existing.quotedAt) {
      updateData.quotedAt = now;
    }
    if (status === 'confirmed' && !existing.confirmedAt) {
      updateData.confirmedAt = now;
    }
    if (status === 'completed' && !existing.completedAt) {
      updateData.completedAt = now;
    }

    if (items && Array.isArray(items)) {
      let calculatedTotalCost = 0;
      let calculatedTotalPrice = 0;

      for (const item of items) {
        const itemTotalCost = item.totalCost || (item.unitCost || 0) * (item.quantity || 0);
        const itemTotalPrice = item.totalPrice || item.totalAmount || (item.unitPrice || 0) * (item.quantity || 0);
        calculatedTotalCost += itemTotalCost;
        calculatedTotalPrice += itemTotalPrice;
      }

      updateData.totalCost = calculatedTotalCost;
      updateData.totalPrice = calculatedTotalPrice;
      updateData.profit = calculateUtils.calculateProfit(calculatedTotalPrice, calculatedTotalCost);
      updateData.profitMargin = calculateUtils.calculateProfitMargin(calculatedTotalPrice, calculatedTotalCost);

      const order = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({
          where: { orderId: parseInt(id) }
        });

        const updatedOrder = await tx.order.update({
          where: { id: parseInt(id) },
          data: updateData
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemTotalCost = item.totalCost || (item.unitCost || 0) * (item.quantity || 0);
          const itemTotalPrice = item.totalPrice || item.totalAmount || (item.unitPrice || 0) * (item.quantity || 0);
          await tx.orderItem.create({
            data: {
              orderId: updatedOrder.id,
              productId: item.productId ? parseInt(item.productId) : null,
              productionBatchId: item.productionBatchId ? parseInt(item.productionBatchId) : null,
              productName: item.productName || '未知产品',
              quantity: parseFloat(item.quantity),
              unit: item.unit || '个',
              unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
              unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
              totalCost: itemTotalCost,
              totalPrice: itemTotalPrice,
              profit: itemTotalPrice - itemTotalCost,
              note: item.note || item.remarks
            }
          });
        }

        return tx.order.findUnique({
          where: { id: updatedOrder.id },
          include: {
            customer: true,
            items: {
              include: {
                product: true,
                productionBatch: true
              }
            }
          }
        });
      });

      res.json({ 
        data: mapperUtils.mapOrder(order), 
        message: '订单更新成功',
        warnings: warningUtils.checkOrder(order)
      });
    } else {
      const order = await prisma.order.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              productionBatch: true
            }
          }
        }
      });

      res.json({ 
        data: mapperUtils.mapOrder(order), 
        message: '订单更新成功',
        warnings: warningUtils.checkOrder(order)
      });
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: '订单不存在' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: { orderId: parseInt(id) }
      });
      await tx.order.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({ message: '订单删除成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
