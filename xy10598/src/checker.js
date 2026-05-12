const { getDb } = require('./db');
const { formatMoney, generatePeriod } = require('./utils');

function runChecks(workDir, period) {
  const db = getDb();
  const issues = [];

  const periodStart = `${period.slice(0, 4)}-${period.slice(4, 6)}-01`;
  const nextPeriod = getNextPeriod(period);
  const periodEnd = `${nextPeriod.slice(0, 4)}-${nextPeriod.slice(4, 6)}-01`;

  const checks = [
    checkOrdersWithoutAllocation,
    checkReturnWithoutOriginal,
    checkAllocationRatio,
    checkCrossMonthReturns,
    checkTransferAttribution,
    checkDuplicateOrders,
    checkPromotionValidity
  ];

  checks.forEach(check => {
    const result = check(db, periodStart, periodEnd, period);
    if (result && result.length > 0) {
      issues.push(...result);
    }
  });

  return {
    period,
    totalIssues: issues.length,
    issues,
    summary: generateCheckSummary(issues)
  };
}

function getNextPeriod(period) {
  const year = parseInt(period.slice(0, 4));
  const month = parseInt(period.slice(4, 6));
  if (month === 12) {
    return `${year + 1}01`;
  }
  return `${year}${String(month + 1).padStart(2, '0')}`;
}

function checkOrdersWithoutAllocation(db, periodStart, periodEnd, period) {
  const orders = db.prepare(`
    SELECT so.order_no, so.order_date, so.net_amount, so.store_code
    FROM sales_orders so
    LEFT JOIN staff_allocations sa ON so.order_no = sa.order_no
    WHERE so.order_date >= ? AND so.order_date < ?
      AND so.status = 'completed'
      AND sa.order_no IS NULL
  `).all(periodStart, periodEnd);

  return orders.map(order => ({
    type: 'warning',
    category: 'missing_allocation',
    description: `订单 ${order.order_no} 无导购分摊记录`,
    details: `日期: ${order.order_date}, 金额: ¥${formatMoney(order.net_amount)}, 门店: ${order.store_code}`,
    orderNo: order.order_no
  }));
}

function checkReturnWithoutOriginal(db, periodStart, periodEnd, period) {
  const returns = db.prepare(`
    SELECT ro.return_no, ro.return_date, ro.total_amount, ro.store_code
    FROM return_orders ro
    WHERE ro.return_date >= ? AND ro.return_date < ?
      AND ro.status = 'completed'
      AND ro.original_order_no IS NULL
  `).all(periodStart, periodEnd);

  return returns.map(ret => ({
    type: 'warning',
    category: 'return_no_original',
    description: `退货单 ${ret.return_no} 无关联原订单`,
    details: `日期: ${ret.return_date}, 金额: ¥${formatMoney(ret.total_amount)}, 门店: ${ret.store_code}`,
    returnNo: ret.return_no
  }));
}

function checkAllocationRatio(db, periodStart, periodEnd, period) {
  const orders = db.prepare(`
    SELECT order_no, SUM(allocation_ratio) as total_ratio
    FROM staff_allocations
    WHERE order_no IN (
      SELECT order_no FROM sales_orders 
      WHERE order_date >= ? AND order_date < ?
    )
    GROUP BY order_no
    HAVING ABS(total_ratio - 1.0) > 0.0001
  `).all(periodStart, periodEnd);

  return orders.map(order => ({
    type: 'error',
    category: 'allocation_ratio_error',
    description: `订单 ${order.order_no} 分摊比例不等于100%`,
    details: `当前比例: ${(order.total_ratio * 100).toFixed(2)}%`,
    orderNo: order.order_no
  }));
}

function checkCrossMonthReturns(db, periodStart, periodEnd, period) {
  const returns = db.prepare(`
    SELECT ro.return_no, ro.return_date, ro.original_order_no, 
           so.order_date as original_date, ro.total_amount
    FROM return_orders ro
    JOIN sales_orders so ON ro.original_order_no = so.order_no
    WHERE ro.return_date >= ? AND ro.return_date < ?
      AND ro.status = 'completed'
  `).all(periodStart, periodEnd);

  return returns
    .filter(ret => generatePeriod(ret.return_date) !== generatePeriod(ret.original_date))
    .map(ret => ({
      type: 'info',
      category: 'cross_month_return',
      description: `跨月退货: ${ret.return_no}`,
      details: `原订单 ${ret.original_order_no} (${ret.original_date}) → 退货 (${ret.return_date}), 金额: ¥${formatMoney(ret.total_amount)}`,
      returnNo: ret.return_no
    }));
}

function checkTransferAttribution(db, periodStart, periodEnd, period) {
  const transfers = db.prepare(`
    SELECT st.transfer_no, st.transfer_date, st.from_store_code, st.to_store_code,
           st.sku, st.sale_order_no
    FROM store_transfers st
    WHERE st.transfer_date >= ? AND st.transfer_date < ?
  `).all(periodStart, periodEnd);

  const issues = [];
  transfers.forEach(tf => {
    if (tf.sale_order_no) {
      const order = db.prepare(`
        SELECT order_no, source_store_code, is_transfer_sale
        FROM sales_orders 
        WHERE order_no = ?
      `).get(tf.sale_order_no);

      if (order && !order.is_transfer_sale) {
        issues.push({
          type: 'warning',
          category: 'transfer_attribution',
          description: `调拨销售归属可能有误`,
          details: `调拨单 ${tf.transfer_no}: ${tf.from_store_code}→${tf.to_store_code}, 订单 ${tf.sale_order_no} 未标记为调拨销售`,
          transferNo: tf.transfer_no
        });
      }
    }
  });

  return issues;
}

function checkDuplicateOrders(db, periodStart, periodEnd, period) {
  const duplicates = db.prepare(`
    SELECT customer_phone, order_date, COUNT(*) as cnt,
           GROUP_CONCAT(order_no) as order_nos
    FROM sales_orders
    WHERE order_date >= ? AND order_date < ?
      AND customer_phone IS NOT NULL
    GROUP BY customer_phone, order_date, net_amount
    HAVING cnt > 1
  `).all(periodStart, periodEnd);

  return duplicates.map(d => ({
    type: 'warning',
    category: 'possible_duplicate',
    description: `疑似重复订单`,
    details: `日期: ${d.order_date}, 客户: ${d.customer_phone}, 订单: ${d.order_nos}`,
    orderNos: d.order_nos.split(',')
  }));
}

function checkPromotionValidity(db, periodStart, periodEnd, period) {
  const issues = [];
  
  const promoOrders = db.prepare(`
    SELECT so.order_no, so.order_date, so.promotion_code, p.promotion_name,
           p.start_date, p.end_date
    FROM sales_orders so
    JOIN promotions p ON so.promotion_code = p.promotion_code
    WHERE so.order_date >= ? AND so.order_date < ?
  `).all(periodStart, periodEnd);

  promoOrders.forEach(order => {
    const orderDate = new Date(order.order_date);
    const startDate = new Date(order.start_date);
    const endDate = new Date(order.end_date);
    
    if (orderDate < startDate || orderDate > endDate) {
      issues.push({
        type: 'error',
        category: 'promotion_invalid',
        description: `订单 ${order.order_no} 使用了不在有效期内的活动`,
        details: `活动: ${order.promotion_name} (${order.start_date}~${order.end_date}), 订单日期: ${order.order_date}`,
        orderNo: order.order_no
      });
    }
  });

  return issues;
}

function generateCheckSummary(issues) {
  const counts = {
    error: 0,
    warning: 0,
    info: 0
  };
  const categories = {};

  issues.forEach(issue => {
    counts[issue.type]++;
    categories[issue.category] = (categories[issue.category] || 0) + 1;
  });

  return {
    counts,
    categories,
    status: counts.error > 0 ? 'failed' : (counts.warning > 0 ? 'needs_review' : 'passed')
  };
}

function getPendingReviewOrders(period) {
  const db = getDb();
  
  const periodStart = `${period.slice(0, 4)}-${period.slice(4, 6)}-01`;
  const nextPeriod = getNextPeriod(period);
  const periodEnd = `${nextPeriod.slice(0, 4)}-${nextPeriod.slice(4, 6)}-01`;

  const noAllocation = db.prepare(`
    SELECT so.*, 'no_allocation' as issue_type
    FROM sales_orders so
    LEFT JOIN staff_allocations sa ON so.order_no = sa.order_no
    WHERE so.order_date >= ? AND so.order_date < ?
      AND so.status = 'completed'
      AND sa.order_no IS NULL
  `).all(periodStart, periodEnd);

  const crossMonthReturns = db.prepare(`
    SELECT ro.*, so.order_date as original_date, 'cross_month' as issue_type
    FROM return_orders ro
    JOIN sales_orders so ON ro.original_order_no = so.order_no
    WHERE ro.return_date >= ? AND ro.return_date < ?
      AND ro.status = 'completed'
  `).all(periodStart, periodEnd).filter(r => generatePeriod(r.return_date) !== generatePeriod(r.original_date));

  return {
    ordersWithoutAllocation: noAllocation,
    crossMonthReturns,
    totalPending: noAllocation.length + crossMonthReturns.length
  };
}

module.exports = {
  runChecks,
  getPendingReviewOrders
};
