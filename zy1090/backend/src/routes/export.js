import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { dateUtils, calculateUtils } from '../utils/index.js';

const router = Router();
const prisma = new PrismaClient();

function generateMarkdownReport(data, type) {
  let markdown = '';
  const now = new Date().toLocaleString('zh-CN');

  if (type === 'trace' && data.batch) {
    const { batch, affectedProduction, affectedOrders, summary, recallImpact } = data;

    markdown = `# 材料批次追溯报告

> 生成时间: ${now}

---

## 一、材料批次基本信息

| 项目 | 内容 |
|------|------|
| 批次号 | ${batch.batchNumber} |
| 材料名称 | ${batch.materialName || '-'} |
| 供应商 | ${batch.supplierName || '-'} |
| 总数量 | ${batch.totalQuantity} ${batch.unit} |
| 已使用 | ${batch.usedQuantity} ${batch.unit} |
| 剩余数量 | ${batch.remainingQuantity} ${batch.unit} |
| 单价 | ¥${batch.unitPrice.toFixed(2)} |
| 总金额 | ¥${batch.totalPrice.toFixed(2)} |
| 有效期 | ${batch.expiryDate ? dateUtils.formatDate(batch.expiryDate) : '-'} |
| 状态 | ${batch.status} |
| 过敏原 | ${batch.allergens || '无'} |

### 风险提示

${batch.isExpired ? '⚠️ **材料已过期**' : ''}
${batch.isExpiringSoon ? `⚠️ **材料即将过期** (${batch.daysUntilExpiry} 天后过期)` : ''}

---

## 二、影响范围分析

### 1. 受影响的生产批次 (共 ${summary.totalProductionAffected} 批)

| 生产批次号 | 产品名称 | 生产数量 | 材料用量 | 材料成本 | 状态 |
|-----------|---------|---------|---------|---------|------|
${affectedProduction.map(p => `| ${p.batchNumber} | ${p.productName || '-'} | ${p.quantity} ${p.unit} | ${p.materialUsed} ${p.materialUnit} | ¥${(p.materialCost || 0).toFixed(2)} | ${p.status} |`).join('\n')}

### 2. 受影响的订单 (共 ${summary.totalOrdersAffected} 个)

| 订单号 | 客户名称 | 联系方式 | 数量 | 订单金额 | 利润 | 状态 |
|-------|---------|---------|------|---------|------|------|
${affectedOrders.map(o => `| ${o.orderNumber} | ${o.customerName || '-'} | ${o.customerContact || '-'} | ${o.quantity} | ¥${(o.totalPrice || 0).toFixed(2)} | ¥${(o.profit || 0).toFixed(2)} | ${o.status} |`).join('\n')}

### 3. 影响统计

| 统计项 | 数值 |
|--------|------|
| 受影响生产批次 | ${summary.totalProductionAffected} 批 |
| 受影响订单数 | ${summary.totalOrdersAffected} 个 |
| 受影响客户数 | ${summary.totalCustomersAffected} 人 |
| 受影响成品数量 | ${summary.totalQuantityProduced} 件 |
| 涉及订单总额 | ¥${summary.totalOrderValue.toFixed(2)} |

---

## 三、召回影响评估

${recallImpact.needsRecall ? `
### ⚠️ 需要召回

**原因**: ${recallImpact.reason}

**影响范围**:
- 影响订单数: ${recallImpact.affectedOrdersCount} 个
- 影响客户数: ${recallImpact.affectedCustomersCount} 人

**建议行动**:
1. 立即停止使用该批次材料
2. 通知受影响的客户
3. 评估召回成本
4. 记录召回处理过程

` : `
### ✅ 无需召回

该批次材料目前状态正常，无过期或召回标记。
`}

---

*报告生成于 ${now}*
`;
  }
  else if (type === 'orders' && data.orders) {
    const { orders, summary } = data;

    markdown = `# 订单利润分析报告

> 生成时间: ${now}

---

## 一、订单概览

| 统计项 | 数值 |
|--------|------|
| 订单总数 | ${orders.length} 个 |
| 总营收 | ¥${summary.totalRevenue.toFixed(2)} |
| 总成本 | ¥${summary.totalCost.toFixed(2)} |
| 总利润 | ¥${summary.totalProfit.toFixed(2)} |
| 平均利润率 | ${summary.avgProfitMargin.toFixed(2)}% |
| 亏损订单数 | ${summary.negativeMarginCount} 个 |
| 亏损总额 | ¥${summary.totalLoss.toFixed(2)} |

---

## 二、风险提示

${summary.negativeMarginCount > 0 ? `
### ⚠️ 亏损订单警告

共有 **${summary.negativeMarginCount} 个订单处于亏损状态**，亏损总额为 **¥${summary.totalLoss.toFixed(2)}**。

建议:
1. 检查亏损订单的定价策略
2. 评估成本核算是否准确
3. 考虑调整报价
4. 与客户沟通价格调整

` : ''}

---

## 三、订单明细

${orders.map((order, index) => `
### ${index + 1}. 订单 ${order.orderNumber}

| 项目 | 内容 |
|------|------|
| 客户 | ${order.customer?.name || '-'} |
| 状态 | ${order.status} |
| 总营收 | ¥${(order.totalPrice || 0).toFixed(2)} |
| 总成本 | ¥${(order.totalCost || 0).toFixed(2)} |
| 利润 | ¥${(order.profit || 0).toFixed(2)} |
| 利润率 | ${(order.profitMargin || 0).toFixed(2)}% |
| 备注 | ${order.note || '-'} |

${order.warnings && order.warnings.length > 0 ? `
**警告**:
${order.warnings.map(w => `- ${w.severity === 'danger' ? '🔴' : '🟡'} ${w.message}`).join('\n')}
` : ''}

**订单项**:
| 产品名称 | 数量 | 单位成本 | 单位报价 | 成本 | 报价 | 利润 |
|---------|------|---------|---------|------|------|------|
${order.items?.map(item => `| ${item.productName} | ${item.quantity} | ¥${(item.unitCost || 0).toFixed(2)} | ¥${(item.unitPrice || 0).toFixed(2)} | ¥${(item.totalCost || 0).toFixed(2)} | ¥${(item.totalPrice || 0).toFixed(2)} | ¥${(item.profit || 0).toFixed(2)} |`).join('\n')}

`).join('---\n')}

---

*报告生成于 ${now}*
`;
  }
  else if (type === 'dashboard' && data.overview) {
    const { overview } = data;

    markdown = `# 工作室运营看板报告

> 生成时间: ${now}

---

## 一、业务统计

| 类别 | 数量 |
|------|------|
| 材料种类 | ${overview.statistics.materials} 种 |
| 活跃材料批次 | ${overview.statistics.activeBatches} 批 |
| 产品数量 | ${overview.statistics.products} 个 |
| 配方数量 | ${overview.statistics.recipes} 个 |
| 订单总数 | ${overview.statistics.orders} 个 |
| 生产批次 | ${overview.statistics.production} 批 |
| 客户数量 | ${overview.statistics.customers} 人 |

---

## 二、风险预警

### 1. 临期材料

| 风险等级 | 批次数量 |
|---------|---------|
| 30天内过期 (高风险) | ${overview.risks.expiringSoon.critical} 批 |
| 90天内过期 | ${overview.risks.expiringSoon.count} 批 |

${overview.risks.expiringSoon.items && overview.risks.expiringSoon.items.length > 0 ? `
**临期材料列表**:
| 批次号 | 材料名称 | 剩余数量 | 有效期 | 剩余天数 |
|-------|---------|---------|--------|---------|
${overview.risks.expiringSoon.items.map(b => `| ${b.batchNumber} | ${b.material?.name || '-'} | ${b.remainingQuantity} ${b.unit} | ${dateUtils.formatDate(b.expiryDate)} | ${b.daysUntilExpiry} 天 |`).join('\n')}
` : ''}

### 2. 低库存材料

| 统计项 | 数值 |
|--------|------|
| 低库存批次 | ${overview.risks.lowStock.count} 批 |

${overview.risks.lowStock.items && overview.risks.lowStock.items.length > 0 ? `
**低库存材料列表**:
| 批次号 | 材料名称 | 剩余数量 | 库存百分比 |
|-------|---------|---------|-----------|
${overview.risks.lowStock.items.map(b => `| ${b.batchNumber} | ${b.material?.name || '-'} | ${b.remainingQuantity} ${b.unit} | ${b.percentage.toFixed(1)}% |`).join('\n')}
` : ''}

### 3. 亏损订单

| 统计项 | 数值 |
|--------|------|
| 亏损订单数 | ${overview.risks.negativeMarginOrders.count} 个 |

${overview.risks.negativeMarginOrders.count > 0 ? `
⚠️ **存在亏损订单，请检查订单定价策略**
` : ''}

---

## 三、近期活动

### 1. 最近订单

| 订单号 | 客户 | 金额 | 利润 | 状态 |
|-------|------|------|------|------|
${overview.recentOrders?.map(o => `| ${o.orderNumber} | ${o.customer?.name || '-'} | ¥${(o.totalPrice || 0).toFixed(2)} | ¥${(o.profit || 0).toFixed(2)} | ${o.status} |`).join('\n')}

### 2. 最近生产

| 生产批次号 | 产品 | 数量 | 状态 |
|-----------|------|------|------|
${overview.recentProduction?.map(p => `| ${p.batchNumber} | ${p.product?.name || '-'} | ${p.quantity} ${p.unit} | ${p.status} |`).join('\n')}

---

*报告生成于 ${now}*
`;
  }

  return markdown;
}

function generateHTMLReport(data, type) {
  const markdown = generateMarkdownReport(data, type);
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${type === 'trace' ? '批次追溯报告' : type === 'orders' ? '订单分析报告' : '运营看板报告'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f9fafb;
    }
    .container {
      background: #fff;
      padding: 60px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    h1 { font-size: 28px; color: #1a1a2e; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #667eea; }
    h2 { font-size: 22px; color: #2d3748; margin: 30px 0 15px; padding-left: 12px; border-left: 4px solid #667eea; }
    h3 { font-size: 18px; color: #4a5568; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }
    table th, table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    table th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    table tr:hover { background: #f7fafc; }
    .warning { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107; }
    .danger { background: #f8d7da; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc3545; }
    .success { background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #28a745; }
    .info { background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #17a2b8; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
    .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .metadata { color: #718096; font-size: 14px; margin-bottom: 20px; }
    ul { margin: 10px 0 10px 25px; }
    li { margin: 5px 0; }
    strong { color: #1a1a2e; }
  </style>
</head>
<body>
  <div class="container">
`;

  html += markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^> (.*$)/gim, '<div class="metadata">$1</div>')
    .replace(/^---$/gim, '<hr>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/^⚠️/gim, '<span style="color: #ffc107;">⚠️</span>')
    .replace(/^✅/gim, '<span style="color: #28a745;">✅</span>')
    .replace(/^🔴/gim, '<span style="color: #dc3545;">🔴</span>')
    .replace(/^🟡/gim, '<span style="color: #ffc107;">🟡</span>')
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>');

  html += `
    <div class="footer">报告生成于 ${new Date().toLocaleString('zh-CN')}</div>
  </div>
</body>
</html>`;

  return html;
}

router.get('/trace/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const { format = 'markdown' } = req.query;

    const batch = await prisma.materialBatch.findUnique({
      where: { id: parseInt(batchId) },
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

    for (const usage of batch.usages) {
      const production = usage.productionBatch;
      if (!production) continue;

      affectedProduction.push({
        id: production.id,
        batchNumber: production.batchNumber,
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

    const traceData = {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
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

    if (format === 'html') {
      const html = generateHTMLReport(traceData, 'trace');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trace-${batch.batchNumber}.html"`);
      res.send(html);
    } else {
      const markdown = generateMarkdownReport(traceData, 'trace');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trace-${batch.batchNumber}.md"`);
      res.send(markdown);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const { format = 'markdown', status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    const ordersWithWarnings = orders.map(order => ({
      ...order,
      warnings: order.profit !== null && order.profit < 0 ? [
        { severity: 'danger', message: `亏损 ${Math.abs(order.profit).toFixed(2)} 元` }
      ] : []
    }));

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalCost = orders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const negativeMarginOrders = orders.filter(o => o.profit !== null && o.profit < 0);
    const totalLoss = negativeMarginOrders.reduce((sum, o) => sum + Math.abs(o.profit || 0), 0);

    const reportData = {
      orders: ordersWithWarnings,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        avgProfitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        negativeMarginCount: negativeMarginOrders.length,
        totalLoss
      }
    };

    if (format === 'html') {
      const html = generateHTMLReport(reportData, 'orders');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders-report.html"');
      res.send(html);
    } else {
      const markdown = generateMarkdownReport(reportData, 'orders');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders-report.md"');
      res.send(markdown);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const { format = 'markdown' } = req.query;

    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

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
      totalCustomers,
      recentOrders,
      recentProduction
    ] = await Promise.all([
      prisma.material.count(),
      prisma.materialBatch.count({ where: { status: 'active' } }),
      prisma.materialBatch.findMany({
        where: {
          status: 'active',
          expiryDate: { gte: now, lte: threeMonthsLater },
          remainingQuantity: { gt: 0 }
        },
        include: { material: true, supplier: true },
        orderBy: { expiryDate: 'asc' },
        take: 10
      }),
      prisma.materialBatch.findMany({
        where: { status: 'active', remainingQuantity: { gt: 0 } },
        include: { material: true }
      }),
      prisma.product.count(),
      prisma.recipe.count(),
      prisma.order.count(),
      prisma.order.count({ where: { profit: { lt: 0 } } }),
      prisma.productionBatch.count(),
      prisma.customer.count(),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: true }
      }),
      prisma.productionBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { product: true }
      })
    ]);

    const lowStock = lowStockBatches.filter(
      b => b.remainingQuantity > 0 && b.remainingQuantity < b.quantity * 0.2
    ).map(b => ({
      ...b,
      percentage: (b.remainingQuantity / b.quantity) * 100
    }));

    const criticalExpiring = expiringSoon.filter(
      b => dateUtils.isExpiringSoon(b.expiryDate, 30)
    );

    const reportData = {
      overview: {
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
            items: lowStock.slice(0, 10)
          },
          negativeMarginOrders: {
            count: negativeMarginOrders
          }
        },
        recentOrders,
        recentProduction
      }
    };

    if (format === 'html') {
      const html = generateHTMLReport(reportData, 'dashboard');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dashboard-report.html"');
      res.send(html);
    } else {
      const markdown = generateMarkdownReport(reportData, 'dashboard');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dashboard-report.md"');
      res.send(markdown);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
