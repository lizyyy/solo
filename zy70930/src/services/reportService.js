const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const db = require('../database');
const { getReadableSummary } = require('./explanationEngine');
const auditService = require('./auditService');

async function generateExcelReport(batchId, userId, userName) {
  const detail = await getReportData(batchId);
  const { batch, records, discrepancies, auditLogs } = detail;

  const summaryData = [
    ['对账批次信息'],
    ['批次号', batch.batch_no],
    ['批次名称', batch.name],
    ['门店', batch.store_name || '全部门店'],
    ['对账周期', `${batch.period_start} 至 ${batch.period_end}`],
    ['状态', getStatusText(batch.status)],
    ['创建人', batch.creator_name],
    ['创建时间', batch.created_at],
    [''],
    ['对账汇总'],
    ['套餐数量', batch.total_packages || 0],
    ['工单数量', batch.total_work_orders || 0],
    ['库存配件数量', batch.total_inventory_items || 0],
    ['匹配成功', batch.matched_count || 0],
    ['差异数量', batch.discrepancy_count || 0],
    ['已复核', batch.reviewed_count || 0],
    ['未复核', (records.length - (batch.reviewed_count || 0))]
  ];

  const discrepancyData = [
    ['差异明细'],
    ['序号', '类型', '严重程度', '期望', '实际', '差异说明', '状态', '处理人', '处理时间']
  ];

  discrepancies.forEach((d, i) => {
    let explanationText = '';
    try {
      const exp = JSON.parse(d.explanation || '{}');
      explanationText = exp.summary || d.explanation || '';
    } catch {
      explanationText = d.explanation || '';
    }

    discrepancyData.push([
      i + 1,
      getDiscrepancyTypeText(d.discrepancy_type),
      getSeverityText(d.severity),
      d.expected_value || '',
      d.actual_value || '',
      explanationText,
      d.is_resolved ? '已解决' : '待处理',
      d.resolved_by || '',
      d.resolved_at || ''
    ]);
  });

  const recordData = [
    ['对账记录明细'],
    ['序号', '记录类型', '关联编号', '状态', '复核状态', '复核结果', '复核意见', '复核人', '复核时间']
  ];

  records.forEach((r, i) => {
    recordData.push([
      i + 1,
      getRecordTypeText(r.record_type),
      r.reference_no,
      r.status === 'matched' ? '匹配' : '有差异',
      r.review_status === 'reviewed' ? '已复核' : '待复核',
      getReviewResultText(r.review_result),
      r.review_comment || '',
      r.reviewed_by ? r.reviewed_by : '',
      r.reviewed_at || ''
    ]);
  });

  const auditData = [
    ['操作日志'],
    ['序号', '操作人', '操作类型', '操作时间', '详情']
  ];

  auditLogs.forEach((log, i) => {
    let details = '';
    try {
      const d = JSON.parse(log.action_details || '{}');
      details = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch {
      details = log.action_details || '';
    }

    auditData.push([
      i + 1,
      log.user_name,
      getActionText(log.action),
      log.created_at,
      details
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  const ws2 = XLSX.utils.aoa_to_sheet(discrepancyData);
  const ws3 = XLSX.utils.aoa_to_sheet(recordData);
  const ws4 = XLSX.utils.aoa_to_sheet(auditData);

  XLSX.utils.book_append_sheet(wb, ws1, '汇总信息');
  XLSX.utils.book_append_sheet(wb, ws2, '差异明细');
  XLSX.utils.book_append_sheet(wb, ws3, '对账记录');
  XLSX.utils.book_append_sheet(wb, ws4, '操作日志');

  const fileName = `对账报告_${batch.batch_no}_${moment().format('YYYYMMDDHHmmss')}.xlsx`;
  const filePath = path.join(__dirname, '../../exports', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  XLSX.writeFile(wb, filePath);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.REPORT_EXPORTED,
    { batchId, fileName, format: 'excel' },
    null, null, batchId, null
  );

  return { filePath, fileName };
}

async function generatePdfReport(batchId, userId, userName) {
  const detail = await getReportData(batchId);
  const { batch, records, discrepancies, auditLogs } = detail;

  const fileName = `对账报告_${batch.batch_no}_${moment().format('YYYYMMDDHHmmss')}.pdf`;
  const filePath = path.join(__dirname, '../../exports', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const fontPath = path.join(__dirname, '../../fonts/NotoSansSC-Regular.otf');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.registerFont('chinese', fontPath);
  doc.font('chinese');

  doc.fontSize(20).text('汽修连锁对账报告', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text('批次信息', { underline: true });
  doc.fontSize(10);
  doc.text(`批次号: ${batch.batch_no}`);
  doc.text(`批次名称: ${batch.name}`);
  doc.text(`门店: ${batch.store_name || '全部门店'}`);
  doc.text(`对账周期: ${batch.period_start} 至 ${batch.period_end}`);
  doc.text(`状态: ${getStatusText(batch.status)}`);
  doc.text(`创建人: ${batch.creator_name}`);
  doc.text(`创建时间: ${batch.created_at}`);
  doc.moveDown();

  doc.fontSize(14).text('对账汇总', { underline: true });
  doc.fontSize(10);
  const summaryTable = [
    ['套餐数量', batch.total_packages || 0],
    ['工单数量', batch.total_work_orders || 0],
    ['库存配件数量', batch.total_inventory_items || 0],
    ['匹配成功', batch.matched_count || 0],
    ['差异数量', batch.discrepancy_count || 0],
    ['已复核', batch.reviewed_count || 0],
    ['未复核', records.length - (batch.reviewed_count || 0)]
  ];

  summaryTable.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`);
  });
  doc.moveDown();

  if (discrepancies.length > 0) {
    doc.fontSize(14).text('差异明细', { underline: true });
    doc.fontSize(10);
    doc.moveDown();

    discrepancies.forEach((d, i) => {
      let explanationText = '';
      try {
        const exp = JSON.parse(d.explanation || '{}');
        explanationText = exp.summary || d.explanation || '';
      } catch {
        explanationText = d.explanation || '';
      }

      doc.fontSize(11).text(`#${i + 1} ${getDiscrepancyTypeText(d.discrepancy_type)} - ${getSeverityText(d.severity)}`);
      doc.fontSize(9);
      doc.text(`期望: ${d.expected_value || '-'} | 实际: ${d.actual_value || '-'}`);
      doc.text(`说明: ${explanationText}`);
      doc.text(`状态: ${d.is_resolved ? '已解决' : '待处理'}`);
      if (d.is_resolved) {
        doc.text(`处理: ${d.resolved_by} at ${d.resolved_at}`);
        doc.text(`处理意见: ${d.resolution_comment || ''}`);
      }
      doc.moveDown(0.5);
    });
  }

  doc.end();

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.REPORT_EXPORTED,
    { batchId, fileName, format: 'pdf' },
    null, null, batchId, null
  );

  return { filePath, fileName };
}

async function getReportData(batchId) {
  const batch = await db.get(`
    SELECT b.*, s.name as store_name, u.real_name as creator_name
    FROM reconciliation_batches b
    LEFT JOIN stores s ON b.store_id = s.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.id = ?
  `, [batchId]);

  if (!batch) throw new Error('批次不存在');

  const records = await db.all(`
    SELECT r.*, u.real_name as reviewer_name
    FROM reconciliation_records r
    LEFT JOIN users u ON r.reviewed_by = u.id
    WHERE r.batch_id = ?
    ORDER BY r.created_at DESC
  `, [batchId]);

  const discrepancies = await db.all(`
    SELECT d.*, u.real_name as resolver_name
    FROM reconciliation_discrepancies d
    LEFT JOIN users u ON d.resolved_by = u.id
    WHERE d.batch_id = ?
    ORDER BY d.severity DESC, d.created_at DESC
  `, [batchId]);

  const auditLogs = await db.all(`
    SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC
  `, [batchId]);

  return { batch, records, discrepancies, auditLogs };
}

function getStatusText(status) {
  const map = {
    draft: '草稿',
    importing: '导入中',
    ready: '待对账',
    reconciling: '对账中',
    reconciled: '对账完成',
    reviewing: '复核中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getDiscrepancyTypeText(type) {
  const map = {
    cross_store_redemption: '跨店核销',
    item_replacement: '项目替换',
    inventory_shortage: '库存盘亏',
    inventory_surplus: '库存盘盈',
    package_usage_mismatch: '套餐项目不匹配',
    quantity_mismatch: '使用数量不符',
    price_mismatch: '价格差异',
    missing_package: '套餐不存在',
    missing_work_order: '缺少工单',
    amount_mismatch: '金额不符'
  };
  return map[type] || type;
}

function getSeverityText(severity) {
  const map = { high: '高', medium: '中', low: '低' };
  return map[severity] || severity;
}

function getRecordTypeText(type) {
  const map = { work_order: '工单', package: '套餐', inventory: '库存' };
  return map[type] || type;
}

function getReviewResultText(result) {
  const map = { approved: '通过', rejected: '退回', need_more_info: '需补充材料' };
  return map[result] || '-';
}

function getActionText(action) {
  const map = {
    batch_created: '创建批次',
    batch_status_changed: '状态变更',
    data_imported: '数据导入',
    reconciliation_run: '执行对账',
    record_reviewed: '复核记录',
    discrepancy_resolved: '解决差异',
    batch_completed: '完成批次',
    report_exported: '导出报告',
    data_deleted: '删除数据'
  };
  return map[action] || action;
}

module.exports = {
  generateExcelReport,
  generatePdfReport,
  getReportData
};
