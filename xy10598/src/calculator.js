const { generateId, generatePeriod, getPrevPeriod, formatMoney } = require('./utils');
const { getDb } = require('./db');

function calculateCommission(workDir, period, options = {}) {
  const db = getDb();
  const calculationId = `CALC-${period}-${Date.now()}`;
  const operator = options.operator || 'system';
  const forceRecalc = options.force || false;

  const periodStart = `${period.slice(0, 4)}-${period.slice(4, 6)}-01`;
  const nextPeriod = getNextPeriod(period);
  const periodEnd = `${nextPeriod.slice(0, 4)}-${nextPeriod.slice(4, 6)}-01`;

  const existingStatus = db.prepare('SELECT * FROM calculation_status WHERE period = ?').get(period);
  if (existingStatus && existingStatus.status === 'completed' && !forceRecalc) {
    return {
      period,
      status: 'already_calculated',
      message: `期间 ${period} 已经计算完成，如需重新计算请使用 --force`,
      lastCalculatedAt: existingStatus.last_calculated_at
    };
  }

  db.transaction(() => {
    if (existingStatus) {
      db.prepare('DELETE FROM commission_calculations WHERE period = ?').run(period);
    }

    const sales = db.prepare(`
      SELECT so.*, 
             p.commission_multiplier,
             p.promotion_name
      FROM sales_orders so
      LEFT JOIN promotions p ON so.promotion_code = p.promotion_code
      WHERE so.order_date >= ? AND so.order_date < ?
        AND so.status = 'completed'
    `).all(periodStart, periodEnd);

    sales.forEach(order => {
      processSalesOrder(order, calculationId, period);
    });

    const returns = db.prepare(`
      SELECT ro.*, so.order_date as original_order_date, so.store_code as original_store
      FROM return_orders ro
      LEFT JOIN sales_orders so ON ro.original_order_no = so.order_no
      WHERE ro.return_date >= ? AND ro.return_date < ?
        AND ro.status = 'completed'
    `).all(periodStart, periodEnd);

    returns.forEach(ret => {
      processReturnOrder(ret, calculationId, period);
    });

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO calculation_status 
      (period, status, last_calculated_at, calculation_id)
      VALUES (?, 'completed', CURRENT_TIMESTAMP, ?)
    `);
    insertStmt.run(period, calculationId);
  })();

  const summary = getCalculationSummary(period);
  return {
    period,
    status: 'completed',
    calculationId,
    summary,
    message: `提成计算完成: ${period}`
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

function processSalesOrder(order, calculationId, period) {
  const db = getDb();
  
  const allocations = db.prepare(`
    SELECT sa.*, s.staff_name
    FROM staff_allocations sa
    JOIN staff s ON sa.staff_code = s.staff_code
    WHERE sa.order_no = ?
  `).all(order.order_no);

  if (allocations.length === 0) {
    console.log(`  ⚠️  订单 ${order.order_no} 无导购分摊记录`);
    return;
  }

  const items = db.prepare(`
    SELECT soi.*, p.category, p.base_commission_rate as product_rate
    FROM sales_order_items soi
    LEFT JOIN products p ON soi.sku = p.sku
    WHERE soi.order_no = ?
  `).all(order.order_no);

  let commissionMultiplier = 1.0;
  let promotionNote = '';
  
  if (order.commission_multiplier) {
    commissionMultiplier = order.commission_multiplier;
    promotionNote = `活动扣减(${order.promotion_name}): x${commissionMultiplier}`;
  }

  if (items.length === 0) {
    const baseRate = 0.02;
    const effectiveRate = baseRate * commissionMultiplier;
    
    allocations.forEach(alloc => {
      const lineCommission = order.net_amount * effectiveRate * alloc.allocation_ratio;

      const rules = [
        `基础提成率: ${(baseRate * 100).toFixed(1)}%`,
        `分摊比例: ${(alloc.allocation_ratio * 100).toFixed(0)}%`,
      ];
      if (promotionNote) rules.push(promotionNote);

      let attributionNote = '';
      if (order.is_transfer_sale && order.source_store_code !== order.store_code) {
        attributionNote = `调拨销售: 来源店${order.source_store_code}`;
      }

      const stmt = db.prepare(`
        INSERT INTO commission_calculations (
          calculation_id, staff_code, order_no, period,
          base_amount, commission_amount, commission_type,
          calculation_rule, deduction_reason
        ) VALUES (?, ?, ?, ?, ?, ?, 'sale', ?, ?)
      `);

      stmt.run(
        calculationId,
        alloc.staff_code,
        order.order_no,
        period,
        order.net_amount,
        Number(lineCommission.toFixed(2)),
        rules.join('; '),
        attributionNote || null
      );
    });
  } else {
    allocations.forEach(alloc => {
      items.forEach(item => {
        const baseRate = item.product_rate || item.commission_rate || 0.02;
        const effectiveRate = baseRate * commissionMultiplier;
        const lineCommission = item.line_net_amount * effectiveRate * alloc.allocation_ratio;

        const rules = [
          `基础提成率: ${(baseRate * 100).toFixed(1)}%`,
          `分摊比例: ${(alloc.allocation_ratio * 100).toFixed(0)}%`,
        ];
        if (promotionNote) rules.push(promotionNote);

        let attributionNote = '';
        if (order.is_transfer_sale && order.source_store_code !== order.store_code) {
          attributionNote = `调拨销售: 来源店${order.source_store_code}`;
        }

        const stmt = db.prepare(`
          INSERT INTO commission_calculations (
            calculation_id, staff_code, order_no, period,
            base_amount, commission_amount, commission_type,
            calculation_rule, deduction_reason
          ) VALUES (?, ?, ?, ?, ?, ?, 'sale', ?, ?)
        `);

        stmt.run(
          calculationId,
          alloc.staff_code,
          order.order_no,
          period,
          item.line_net_amount,
          Number(lineCommission.toFixed(2)),
          rules.join('; '),
          attributionNote || null
        );
      });
    });
  }
}

function processReturnOrder(ret, calculationId, period) {
  const db = getDb();

  if (!ret.original_order_no) {
    console.log(`  ⚠️  退货单 ${ret.return_no} 无关联原订单`);
    return;
  }

  const originalPeriod = ret.original_order_date ? generatePeriod(ret.original_order_date) : period;
  const isCrossMonth = originalPeriod !== period;

  const originalAllocations = db.prepare(`
    SELECT sa.*, s.staff_name
    FROM staff_allocations sa
    JOIN staff s ON sa.staff_code = s.staff_code
    WHERE sa.order_no = ?
  `).all(ret.original_order_no);

  if (originalAllocations.length === 0) {
    console.log(`  ⚠️  原订单 ${ret.original_order_no} 无分摊记录`);
    return;
  }

  const originalItems = db.prepare(`
    SELECT soi.*, p.category, p.base_commission_rate as product_rate
    FROM sales_order_items soi
    LEFT JOIN products p ON soi.sku = p.sku
    WHERE soi.order_no = ?
  `).all(ret.original_order_no);

  const originalTotal = getOriginalTotal(ret.original_order_no);
  const returnRatio = Math.min(1, ret.total_amount / originalTotal);

  if (originalItems.length === 0) {
    const baseRate = 0.02;
    
    originalAllocations.forEach(alloc => {
      const lineCommission = originalTotal * baseRate * alloc.allocation_ratio * returnRatio;

      const rules = [
        `退货冲抵`,
        `原订单: ${ret.original_order_no}`,
        `冲抵比例: ${(returnRatio * 100).toFixed(0)}%`,
      ];

      let deductionReason = '';
      if (isCrossMonth) {
        deductionReason = `跨月冲抵: 原单期间 ${originalPeriod}`;
      }

      const stmt = db.prepare(`
        INSERT INTO commission_calculations (
          calculation_id, staff_code, return_no, period,
          base_amount, commission_amount, commission_type,
          calculation_rule, deduction_reason
        ) VALUES (?, ?, ?, ?, ?, ?, 'return', ?, ?)
      `);

      stmt.run(
        calculationId,
        alloc.staff_code,
        ret.return_no,
        period,
        -ret.total_amount,
        Number((-lineCommission).toFixed(2)),
        rules.join('; '),
        deductionReason || null
      );
    });
  } else {
    originalAllocations.forEach(alloc => {
      originalItems.forEach(item => {
        const baseRate = item.product_rate || item.commission_rate || 0.02;
        const lineCommission = item.line_net_amount * baseRate * alloc.allocation_ratio * returnRatio;

        const rules = [
          `退货冲抵`,
          `原订单: ${ret.original_order_no}`,
          `冲抵比例: ${(returnRatio * 100).toFixed(0)}%`,
        ];

        let deductionReason = '';
        if (isCrossMonth) {
          deductionReason = `跨月冲抵: 原单期间 ${originalPeriod}`;
        }

        const stmt = db.prepare(`
          INSERT INTO commission_calculations (
            calculation_id, staff_code, return_no, period,
            base_amount, commission_amount, commission_type,
            calculation_rule, deduction_reason
          ) VALUES (?, ?, ?, ?, ?, ?, 'return', ?, ?)
        `);

        stmt.run(
          calculationId,
          alloc.staff_code,
          ret.return_no,
          period,
          -ret.total_amount,
          Number((-lineCommission).toFixed(2)),
          rules.join('; '),
          deductionReason || null
        );
      });
    });
  }
}

function getOriginalTotal(orderNo) {
  const db = getDb();
  const result = db.prepare('SELECT net_amount FROM sales_orders WHERE order_no = ?').get(orderNo);
  return result ? result.net_amount : 0;
}

function getCalculationSummary(period) {
  const db = getDb();
  
  const salesTotal = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) as total
    FROM commission_calculations
    WHERE period = ? AND commission_type = 'sale'
  `).get(period).total;

  const returnTotal = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) as total
    FROM commission_calculations
    WHERE period = ? AND commission_type = 'return'
  `).get(period).total;

  const staffCount = db.prepare(`
    SELECT COUNT(DISTINCT staff_code) as count
    FROM commission_calculations
    WHERE period = ?
  `).get(period).count;

  return {
    salesCommission: Number(salesTotal.toFixed(2)),
    returnDeduction: Number(returnTotal.toFixed(2)),
    netCommission: Number((salesTotal + returnTotal).toFixed(2)),
    staffCount
  };
}

function getStaffCommission(staffCode, period) {
  const db = getDb();
  
  const details = db.prepare(`
    SELECT cc.*, s.staff_name, so.order_date, so.store_code
    FROM commission_calculations cc
    JOIN staff s ON cc.staff_code = s.staff_code
    LEFT JOIN sales_orders so ON cc.order_no = so.order_no
    WHERE cc.staff_code = ? AND cc.period = ?
    ORDER BY cc.created_at
  `).all(staffCode, period);

  const summary = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN commission_type = 'sale' THEN commission_amount ELSE 0 END), 0) as sales_total,
      COALESCE(SUM(CASE WHEN commission_type = 'return' THEN commission_amount ELSE 0 END), 0) as return_total
    FROM commission_calculations
    WHERE staff_code = ? AND period = ?
  `).get(staffCode, period);

  return {
    staffCode,
    period,
    details,
    summary: {
      salesCommission: Number(summary.sales_total.toFixed(2)),
      returnDeduction: Number(summary.return_total.toFixed(2)),
      netCommission: Number((summary.sales_total + summary.return_total).toFixed(2))
    }
  };
}

function getAllStaffSummary(period) {
  const db = getDb();
  
  return db.prepare(`
    SELECT 
      cc.staff_code,
      s.staff_name,
      s.store_code,
      COALESCE(SUM(CASE WHEN cc.commission_type = 'sale' THEN cc.commission_amount ELSE 0 END), 0) as sales_total,
      COALESCE(SUM(CASE WHEN cc.commission_type = 'return' THEN cc.commission_amount ELSE 0 END), 0) as return_total,
      COUNT(DISTINCT cc.order_no) as order_count
    FROM commission_calculations cc
    JOIN staff s ON cc.staff_code = s.staff_code
    WHERE cc.period = ?
    GROUP BY cc.staff_code, s.staff_name, s.store_code
    ORDER BY (sales_total + return_total) DESC
  `).all(period).map(row => ({
    ...row,
    sales_total: Number(row.sales_total.toFixed(2)),
    return_total: Number(row.return_total.toFixed(2)),
    net_total: Number((row.sales_total + row.return_total).toFixed(2))
  }));
}

module.exports = {
  calculateCommission,
  getCalculationSummary,
  getStaffCommission,
  getAllStaffSummary
};
