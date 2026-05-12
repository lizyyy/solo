const { generateId } = require('./utils');
const { getDb } = require('./db');

function createAdjustment(staffCode, period, adjustedAmount, reason, operator) {
  const db = getDb();

  if (!staffCode || !period || adjustedAmount === undefined || !reason || !operator) {
    throw new Error('缺少必填参数: staffCode, period, adjustedAmount, reason, operator');
  }

  const staff = db.prepare('SELECT staff_code, staff_name FROM staff WHERE staff_code = ?').get(staffCode);
  if (!staff) {
    throw new Error(`导购不存在: ${staffCode}`);
  }

  const originalSummary = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) as original_amount
    FROM commission_calculations
    WHERE staff_code = ? AND period = ?
  `).get(staffCode, period);

  const originalAmount = Number(originalSummary.original_amount.toFixed(2));
  const difference = Number((adjustedAmount - originalAmount).toFixed(2));

  if (Math.abs(difference) < 0.01) {
    throw new Error('调整金额与原金额无差异');
  }

  const adjustmentNo = generateId('ADJ');

  db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO manual_adjustments (
        adjustment_no, staff_code, period,
        original_amount, adjusted_amount, difference,
        reason, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      adjustmentNo,
      staffCode,
      period,
      originalAmount,
      adjustedAmount,
      difference,
      reason,
      operator
    );

    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (
        action, table_name, record_id,
        before_value, after_value, operator
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    auditStmt.run(
      'manual_adjustment',
      'commission_calculations',
      `${staffCode}-${period}`,
      JSON.stringify({ amount: originalAmount }),
      JSON.stringify({ amount: adjustedAmount, reason, adjustmentNo }),
      operator
    );
  })();

  return {
    adjustmentNo,
    staffCode,
    staffName: staff.staff_name,
    period,
    originalAmount,
    adjustedAmount,
    difference,
    reason,
    operator,
    message: difference > 0 
      ? `已增加提成 ¥${difference.toFixed(2)}`
      : `已扣减提成 ¥${Math.abs(difference).toFixed(2)}`
  };
}

function getAdjustmentHistory(staffCode, period) {
  const db = getDb();
  
  const query = `
    SELECT ma.*, s.staff_name
    FROM manual_adjustments ma
    JOIN staff s ON ma.staff_code = s.staff_code
  `;
  
  const params = [];
  const conditions = [];
  
  if (staffCode) {
    conditions.push('ma.staff_code = ?');
    params.push(staffCode);
  }
  if (period) {
    conditions.push('ma.period = ?');
    params.push(period);
  }
  
  const sql = conditions.length > 0 
    ? `${query} WHERE ${conditions.join(' AND ')} ORDER BY ma.created_at DESC`
    : `${query} ORDER BY ma.created_at DESC`;

  return db.prepare(sql).all(...params);
}

function getAuditLogs(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function getAdjustedSummary(period) {
  const db = getDb();
  
  return db.prepare(`
    SELECT 
      s.staff_code,
      s.staff_name,
      s.store_code,
      COALESCE(SUM(CASE WHEN cc.commission_type = 'sale' THEN cc.commission_amount ELSE 0 END), 0) as sales_commission,
      COALESCE(SUM(CASE WHEN cc.commission_type = 'return' THEN cc.commission_amount ELSE 0 END), 0) as return_deduction,
      COALESCE(SUM(cc.commission_amount), 0) as calculated_amount,
      COALESCE(ma.adjusted_amount, 0) as adjusted_amount,
      COALESCE(ma.difference, 0) as adjustment_difference,
      COALESCE(ma.adjusted_amount, SUM(cc.commission_amount)) as final_amount
    FROM staff s
    LEFT JOIN commission_calculations cc ON s.staff_code = cc.staff_code AND cc.period = ?
    LEFT JOIN (
      SELECT staff_code, MAX(created_at) as latest
      FROM manual_adjustments 
      WHERE period = ?
      GROUP BY staff_code
    ) latest_ma ON s.staff_code = latest_ma.staff_code
    LEFT JOIN manual_adjustments ma ON 
      s.staff_code = ma.staff_code AND 
      ma.period = ? AND 
      ma.created_at = latest_ma.latest
    GROUP BY s.staff_code, s.staff_name, s.store_code, ma.adjusted_amount, ma.difference
    HAVING calculated_amount != 0 OR adjustment_difference != 0
    ORDER BY final_amount DESC
  `).all(period, period, period).map(row => ({
    ...row,
    sales_commission: Number(row.sales_commission.toFixed(2)),
    return_deduction: Number(row.return_deduction.toFixed(2)),
    calculated_amount: Number(row.calculated_amount.toFixed(2)),
    adjusted_amount: Number(row.adjusted_amount.toFixed(2)),
    adjustment_difference: Number(row.adjustment_difference.toFixed(2)),
    final_amount: Number(row.final_amount.toFixed(2))
  }));
}

module.exports = {
  createAdjustment,
  getAdjustmentHistory,
  getAuditLogs,
  getAdjustedSummary
};
