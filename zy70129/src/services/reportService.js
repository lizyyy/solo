const { getDatabase } = require('../database/init');
const { generateId } = require('../utils/idGenerator');
const { REPORT_TYPE, ORDER_STATUS, REFUND_QUEUE_STATUS, MODULES } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');

function generateDailyReport(date, operator) {
  const db = getDatabase();
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const depositResult = db.prepare(`
    SELECT COALESCE(SUM(deposit_amount), 0) as total
    FROM rental_orders 
    WHERE created_at BETWEEN ? AND ?
  `).get(startOfDay, endOfDay);

  const damageResult = db.prepare(`
    SELECT COALESCE(SUM(dc.charge_amount), 0) as total
    FROM damage_charges dc
    WHERE dc.created_at BETWEEN ? AND ?
  `).get(startOfDay, endOfDay);

  const utilityResult = db.prepare(`
    SELECT 
      COALESCE((SELECT SUM(ur.calculated_amount) FROM utility_records ur WHERE ur.calculated_amount IS NOT NULL AND ur.created_at BETWEEN ? AND ?), 0) +
      COALESCE((SELECT SUM(ua.allocated_amount) FROM utility_allocations ua WHERE ua.created_at BETWEEN ? AND ?), 0) as total
  `).get(startOfDay, endOfDay, startOfDay, endOfDay);

  const refundResult = db.prepare(`
    SELECT COALESCE(SUM(rr.refund_amount), 0) as total
    FROM refund_records rr
    WHERE rr.status = 'SUCCESS' AND rr.operated_at BETWEEN ? AND ?
  `).get(startOfDay, endOfDay);

  const pendingRefundResult = db.prepare(`
    SELECT COALESCE(SUM(rq.refund_amount), 0) as total
    FROM refund_queue rq
    WHERE rq.status IN (?, ?, ?)
  `).get(
    REFUND_QUEUE_STATUS.PENDING,
    REFUND_QUEUE_STATUS.FAILED,
    REFUND_QUEUE_STATUS.MANUAL_REVIEW
  );

  const totalDeductions = parseFloat((damageResult.total + utilityResult.total).toFixed(2));

  const reportData = {
    report_date: date,
    report_type: REPORT_TYPE.DAILY,
    total_deposits_received: parseFloat(depositResult.total),
    total_damage_charges: parseFloat(damageResult.total),
    total_utility_charges: parseFloat(utilityResult.total),
    total_deductions: totalDeductions,
    total_refunds: parseFloat(refundResult.total),
    pending_refunds: parseFloat(pendingRefundResult.total)
  };

  const existingReport = db.prepare(`
    SELECT * FROM financial_reports 
    WHERE report_date = ? AND report_type = ?
  `).get(date, REPORT_TYPE.DAILY);

  const now = new Date().toISOString();

  if (existingReport) {
    db.prepare(`
      UPDATE financial_reports 
      SET total_deposits_received = ?, total_damage_charges = ?,
          total_utility_charges = ?, total_deductions = ?,
          total_refunds = ?, pending_refunds = ?, created_at = ?
      WHERE id = ?
    `).run(
      reportData.total_deposits_received,
      reportData.total_damage_charges,
      reportData.total_utility_charges,
      reportData.total_deductions,
      reportData.total_refunds,
      reportData.pending_refunds,
      now,
      existingReport.id
    );
  } else {
    db.prepare(`
      INSERT INTO financial_reports (
        id, report_date, report_type, total_deposits_received,
        total_damage_charges, total_utility_charges, total_deductions,
        total_refunds, pending_refunds, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      reportData.report_date,
      reportData.report_type,
      reportData.total_deposits_received,
      reportData.total_damage_charges,
      reportData.total_utility_charges,
      reportData.total_deductions,
      reportData.total_refunds,
      reportData.pending_refunds,
      now
    );
  }

  logAudit('GENERATE', MODULES.REPORT, operator, {
    targetId: date,
    targetType: 'daily_report',
    newValues: reportData
  });

  return getReportByDate(date, REPORT_TYPE.DAILY);
}

function getReportByDate(date, reportType) {
  const db = getDatabase();
  const report = db.prepare(`
    SELECT * FROM financial_reports 
    WHERE report_date = ? AND report_type = ?
  `).get(date, reportType);

  if (!report) return null;

  const details = getReportDetails(date, reportType);
  return {
    ...report,
    details
  };
}

function getReportDetails(date, reportType) {
  const db = getDatabase();
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const orders = db.prepare(`
    SELECT 
      ro.id, ro.order_no, ro.venue_name, ro.customer_name,
      ro.deposit_amount, ro.status, ro.created_at
    FROM rental_orders ro
    WHERE ro.created_at BETWEEN ? AND ?
    ORDER BY ro.created_at ASC
  `).all(startOfDay, endOfDay);

  const damageCharges = db.prepare(`
    SELECT 
      dc.id, dc.order_id, dc.item_name, dc.damage_degree,
      dc.charge_amount, dc.charge_reason, dc.created_at,
      ro.order_no, ro.customer_name
    FROM damage_charges dc
    JOIN rental_orders ro ON dc.order_id = ro.id
    WHERE dc.created_at BETWEEN ? AND ?
    ORDER BY dc.created_at ASC
  `).all(startOfDay, endOfDay);

  const utilityRecords = db.prepare(`
    SELECT 
      ur.id, ur.order_id, ur.utility_type, ur.usage_amount,
      ur.calculated_amount, ur.created_at,
      ro.order_no, ro.customer_name
    FROM utility_records ur
    JOIN rental_orders ro ON ur.order_id = ro.id
    WHERE ur.calculated_amount IS NOT NULL AND ur.created_at BETWEEN ? AND ?
    ORDER BY ur.created_at ASC
  `).all(startOfDay, endOfDay);

  const utilityAllocations = db.prepare(`
    SELECT 
      ua.id, ua.order_id, ua.allocated_amount, ua.allocation_rule,
      ua.created_at, ur.utility_type,
      ro.order_no, ro.customer_name
    FROM utility_allocations ua
    JOIN utility_records ur ON ua.utility_record_id = ur.id
    JOIN rental_orders ro ON ua.order_id = ro.id
    WHERE ua.created_at BETWEEN ? AND ?
    ORDER BY ua.created_at ASC
  `).all(startOfDay, endOfDay);

  const refundRecords = db.prepare(`
    SELECT 
      rr.id, rr.order_id, rr.refund_amount, rr.refund_method,
      rr.transaction_no, rr.status, rr.operated_at,
      ro.order_no, ro.customer_name
    FROM refund_records rr
    JOIN rental_orders ro ON rr.order_id = ro.id
    WHERE rr.status = 'SUCCESS' AND rr.operated_at BETWEEN ? AND ?
    ORDER BY rr.operated_at ASC
  `).all(startOfDay, endOfDay);

  const pendingRefunds = db.prepare(`
    SELECT 
      rq.id, rq.order_id, rq.refund_amount, rq.refund_method,
      rq.status, rq.retry_count, rq.created_at,
      ro.order_no, ro.customer_name
    FROM refund_queue rq
    JOIN rental_orders ro ON rq.order_id = ro.id
    WHERE rq.status IN (?, ?, ?)
    ORDER BY rq.created_at ASC
  `).all(
    REFUND_QUEUE_STATUS.PENDING,
    REFUND_QUEUE_STATUS.FAILED,
    REFUND_QUEUE_STATUS.MANUAL_REVIEW
  );

  const manualAdjustments = db.prepare(`
    SELECT 
      ma.id, ma.order_id, ma.adjustment_type, ma.old_value,
      ma.new_value, ma.adjustment_amount, ma.reason,
      ma.adjusted_by, ma.adjusted_at,
      ro.order_no, ro.customer_name
    FROM manual_adjustments ma
    JOIN rental_orders ro ON ma.order_id = ro.id
    WHERE ma.adjusted_at BETWEEN ? AND ?
    ORDER BY ma.adjusted_at ASC
  `).all(startOfDay, endOfDay);

  return {
    orders,
    damageCharges,
    utilityRecords,
    utilityAllocations,
    refundRecords,
    pendingRefunds,
    manualAdjustments
  };
}

function getOrderExportData(orderId) {
  const db = getDatabase();
  
  const order = db.prepare(`
    SELECT * FROM rental_orders WHERE id = ?
  `).get(orderId);

  if (!order) return null;

  const statusLogs = db.prepare(`
    SELECT from_status, to_status, changed_by, changed_at, reason
    FROM order_status_logs 
    WHERE order_id = ? 
    ORDER BY changed_at ASC
  `).all(orderId);

  const checklists = db.prepare(`
    SELECT item_name, item_category, expected_quantity, actual_quantity,
           is_damaged, damage_degree, unit_price, checked_by, checked_at, remark
    FROM checklists 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  const damageCharges = db.prepare(`
    SELECT item_name, damage_degree, charge_amount, charge_reason,
           created_by, created_at, is_manual_adjustment, adjustment_reason
    FROM damage_charges 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  const utilityRecords = db.prepare(`
    SELECT utility_type, initial_reading, final_reading, usage_amount,
           unit_price, calculated_amount, record_by, record_at
    FROM utility_records 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  const utilityAllocations = db.prepare(`
    SELECT ur.utility_type, ua.allocation_ratio, ua.allocated_amount,
           ua.allocation_rule, ua.created_by, ua.created_at
    FROM utility_allocations ua
    JOIN utility_records ur ON ua.utility_record_id = ur.id
    WHERE ua.order_id = ? 
    ORDER BY ua.created_at ASC
  `).all(orderId);

  const feeSummary = db.prepare(`
    SELECT deposit_amount, damage_total, utility_total, other_deductions,
           total_deductions, refund_amount, calculated_by, calculated_at,
           is_manually_adjusted, adjustment_reason
    FROM order_fee_summaries 
    WHERE order_id = ?
  `).get(orderId);

  const refundQueue = db.prepare(`
    SELECT refund_amount, refund_method, status, retry_count,
           last_error, processed_by, processed_at
    FROM refund_queue 
    WHERE order_id = ?
  `).get(orderId);

  const refundRecords = db.prepare(`
    SELECT refund_amount, refund_method, transaction_no, status,
           operator, operated_at, remark
    FROM refund_records 
    WHERE order_id = ? 
    ORDER BY operated_at ASC
  `).all(orderId);

  const manualAdjustments = db.prepare(`
    SELECT adjustment_type, old_value, new_value, adjustment_amount,
           reason, adjusted_by, adjusted_at
    FROM manual_adjustments 
    WHERE order_id = ? 
    ORDER BY adjusted_at ASC
  `).all(orderId);

  const auditLogs = db.prepare(`
    SELECT action, module, operator, operated_at, old_values, new_values, remark
    FROM audit_logs 
    WHERE target_id = ? AND target_type = 'rental_order'
    ORDER BY operated_at ASC
  `).all(orderId);

  return {
    order,
    statusLogs,
    checklists,
    damageCharges,
    utilityRecords,
    utilityAllocations,
    feeSummary,
    refundQueue,
    refundRecords,
    manualAdjustments,
    auditLogs
  };
}

function exportOrderToCSV(orderId) {
  const data = getOrderExportData(orderId);
  if (!data) return null;

  let csv = '';

  csv += '订单基本信息\n';
  csv += '字段,值\n';
  csv += `订单号,${data.order.order_no}\n`;
  csv += `场馆,${data.order.venue_name}\n`;
  csv += `客户,${data.order.customer_name}\n`;
  csv += `客户电话,${data.order.customer_phone || ''}\n`;
  csv += `押金金额,${data.order.deposit_amount}\n`;
  csv += `开始时间,${data.order.rental_start_time}\n`;
  csv += `结束时间,${data.order.rental_end_time}\n`;
  csv += `实际结束时间,${data.order.actual_end_time || ''}\n`;
  csv += `当前状态,${data.order.status}\n`;
  csv += `创建人,${data.order.created_by}\n`;
  csv += `创建时间,${data.order.created_at}\n`;
  csv += '\n';

  csv += '状态变更历史\n';
  csv += '原状态,新状态,操作人,操作时间,原因\n';
  data.statusLogs.forEach(log => {
    csv += `${log.from_status || '-'},${log.to_status},${log.changed_by},${log.changed_at},${log.reason || ''}\n`;
  });
  csv += '\n';

  csv += '验收清单\n';
  csv += '项目名称,类别,预期数量,实际数量,是否损坏,损坏程度,单价,检查人,检查时间,备注\n';
  data.checklists.forEach(item => {
    csv += `${item.item_name},${item.item_category || ''},${item.expected_quantity},${item.actual_quantity || ''},${item.is_damaged ? '是' : '否'},${item.damage_degree || ''},${item.unit_price || ''},${item.checked_by || ''},${item.checked_at || ''},${item.remark || ''}\n`;
  });
  csv += '\n';

  csv += '损坏扣费明细\n';
  csv += '项目名称,损坏程度,扣费金额,扣费原因,创建人,创建时间,是否人工调整,调整原因\n';
  data.damageCharges.forEach(charge => {
    csv += `${charge.item_name},${charge.damage_degree || ''},${charge.charge_amount},${charge.charge_reason || ''},${charge.created_by},${charge.created_at},${charge.is_manual_adjustment ? '是' : '否'},${charge.adjustment_reason || ''}\n`;
  });
  csv += '\n';

  csv += '水电记录\n';
  csv += '类型,初始读数,最终读数,使用量,单价,费用,记录人,记录时间\n';
  data.utilityRecords.forEach(record => {
    csv += `${record.utility_type},${record.initial_reading},${record.final_reading || ''},${record.usage_amount || ''},${record.unit_price},${record.calculated_amount || ''},${record.record_by || ''},${record.record_at || ''}\n`;
  });
  csv += '\n';

  csv += '水电分摊记录\n';
  csv += '类型,分摊比例,分摊金额,分摊规则,创建人,创建时间\n';
  data.utilityAllocations.forEach(allocation => {
    csv += `${allocation.utility_type},${allocation.allocation_ratio},${allocation.allocated_amount},${allocation.allocation_rule || ''},${allocation.created_by},${allocation.created_at}\n`;
  });
  csv += '\n';

  if (data.feeSummary) {
    csv += '费用汇总\n';
    csv += '项目,金额\n';
    csv += `押金金额,${data.feeSummary.deposit_amount}\n`;
    csv += `损坏扣费合计,${data.feeSummary.damage_total}\n`;
    csv += `水电费用合计,${data.feeSummary.utility_total}\n`;
    csv += `其他扣款,${data.feeSummary.other_deductions}\n`;
    csv += `扣款合计,${data.feeSummary.total_deductions}\n`;
    csv += `应退押金,${data.feeSummary.refund_amount}\n`;
    csv += `计算人,${data.feeSummary.calculated_by || ''}\n`;
    csv += `计算时间,${data.feeSummary.calculated_at || ''}\n`;
    csv += `是否人工调整,${data.feeSummary.is_manually_adjusted ? '是' : '否'}\n`;
    csv += `调整原因,${data.feeSummary.adjustment_reason || ''}\n`;
    csv += '\n';
  }

  if (data.refundQueue) {
    csv += '退款队列\n';
    csv += '退款金额,退款方式,状态,重试次数,最后错误,处理人,处理时间\n';
    csv += `${data.refundQueue.refund_amount},${data.refundQueue.refund_method},${data.refundQueue.status},${data.refundQueue.retry_count},${data.refundQueue.last_error || ''},${data.refundQueue.processed_by || ''},${data.refundQueue.processed_at || ''}\n`;
    csv += '\n';
  }

  csv += '退款记录\n';
  csv += '退款金额,退款方式,交易号,状态,操作人,操作时间,备注\n';
  data.refundRecords.forEach(record => {
    csv += `${record.refund_amount},${record.refund_method},${record.transaction_no || ''},${record.status},${record.operator},${record.operated_at},${record.remark || ''}\n`;
  });
  csv += '\n';

  csv += '人工调整记录\n';
  csv += '调整类型,原值,新值,调整金额,原因,调整人,调整时间\n';
  data.manualAdjustments.forEach(adj => {
    csv += `${adj.adjustment_type},${adj.old_value},${adj.new_value},${adj.adjustment_amount},${adj.reason},${adj.adjusted_by},${adj.adjusted_at}\n`;
  });
  csv += '\n';

  csv += '操作日志\n';
  csv += '动作,模块,操作人,操作时间,备注\n';
  data.auditLogs.forEach(log => {
    csv += `${log.action},${log.module},${log.operator},${log.operated_at},${log.remark || ''}\n`;
  });

  return csv;
}

function exportDailyReportToCSV(date) {
  const report = getReportByDate(date, REPORT_TYPE.DAILY);
  if (!report) return null;

  let csv = '';

  csv += `日报表 - ${date}\n`;
  csv += '\n';

  csv += '汇总数据\n';
  csv += '项目,金额\n';
  csv += `押金收入,${report.total_deposits_received}\n`;
  csv += `损坏扣费,${report.total_damage_charges}\n`;
  csv += `水电费用,${report.total_utility_charges}\n`;
  csv += `扣款合计,${report.total_deductions}\n`;
  csv += `已退押金,${report.total_refunds}\n`;
  csv += `待退押金,${report.pending_refunds}\n`;
  csv += '\n';

  csv += '订单明细\n';
  csv += '订单号,场馆,客户,押金,状态,创建时间\n';
  report.details.orders.forEach(order => {
    csv += `${order.order_no},${order.venue_name},${order.customer_name},${order.deposit_amount},${order.status},${order.created_at}\n`;
  });
  csv += '\n';

  csv += '损坏扣费明细\n';
  csv += '订单号,客户,项目,损坏程度,金额,原因,时间\n';
  report.details.damageCharges.forEach(charge => {
    csv += `${charge.order_no},${charge.customer_name},${charge.item_name},${charge.damage_degree || ''},${charge.charge_amount},${charge.charge_reason || ''},${charge.created_at}\n`;
  });
  csv += '\n';

  csv += '水电费用明细\n';
  csv += '订单号,客户,类型,使用量,金额,时间\n';
  report.details.utilityRecords.forEach(record => {
    csv += `${record.order_no},${record.customer_name},${record.utility_type},${record.usage_amount || ''},${record.calculated_amount || ''},${record.created_at}\n`;
  });
  csv += '\n';

  csv += '退款记录\n';
  csv += '订单号,客户,金额,方式,交易号,时间\n';
  report.details.refundRecords.forEach(record => {
    csv += `${record.order_no},${record.customer_name},${record.refund_amount},${record.refund_method},${record.transaction_no || ''},${record.operated_at}\n`;
  });
  csv += '\n';

  csv += '待退款项\n';
  csv += '订单号,客户,金额,方式,状态,重试次数\n';
  report.details.pendingRefunds.forEach(item => {
    csv += `${item.order_no},${item.customer_name},${item.refund_amount},${item.refund_method},${item.status},${item.retry_count}\n`;
  });
  csv += '\n';

  csv += '人工调整记录\n';
  csv += '订单号,客户,类型,原值,新值,调整金额,原因,调整人,时间\n';
  report.details.manualAdjustments.forEach(adj => {
    csv += `${adj.order_no},${adj.customer_name},${adj.adjustment_type},${adj.old_value},${adj.new_value},${adj.adjustment_amount},${adj.reason},${adj.adjusted_by},${adj.adjusted_at}\n`;
  });

  return csv;
}

module.exports = {
  generateDailyReport,
  getReportByDate,
  getReportDetails,
  getOrderExportData,
  exportOrderToCSV,
  exportDailyReportToCSV
};
