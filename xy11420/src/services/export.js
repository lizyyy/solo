const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const { get, all } = require('../db');

const EXPORT_DIR = path.join(__dirname, '../../exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function generateBatchSummary(batchId) {
  const batchData = get(`
    SELECT b.*,
           u1.real_name as entry_user_name,
           u2.real_name as reviewer_name,
           u3.real_name as manager_name,
           (SELECT COUNT(*) FROM inspection_orders WHERE batch_id = b.id) as inspection_count,
           (SELECT COUNT(*) FROM repair_quotes WHERE batch_id = b.id) as quote_count,
           (SELECT COUNT(*) FROM photo_lists WHERE batch_id = b.id) as photo_count,
           (SELECT COUNT(*) FROM scan_details WHERE batch_id = b.id) as scan_count,
           (SELECT COUNT(*) FROM return_records WHERE batch_id = b.id) as return_count
    FROM batches b
    LEFT JOIN users u1 ON b.entry_user_id = u1.id
    LEFT JOIN users u2 ON b.reviewer_id = u2.id
    LEFT JOIN users u3 ON b.manager_id = u3.id
    WHERE b.id = ?
  `, [batchId]);

  if (!batchData) {
    throw new Error('批次不存在');
  }

  const history = all(`
    SELECT sh.*, u.real_name as operator_name
    FROM status_history sh
    LEFT JOIN users u ON sh.operator_id = u.id
    WHERE sh.batch_id = ?
    ORDER BY sh.created_at ASC
  `, [batchId]);

  const dirtyRecords = all(`
    SELECT dr.*, u.real_name as handler_name
    FROM dirty_records dr
    LEFT JOIN users u ON dr.handler_id = u.id
    WHERE dr.batch_id = ?
    ORDER BY dr.created_at DESC
  `, [batchId]);

  const returns = all(`
    SELECT * FROM return_records WHERE batch_id = ? ORDER BY return_number
  `, [batchId]);

  const quoteTotal = get(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM repair_quotes WHERE batch_id = ?
  `, [batchId]);

  return {
    batch: batchData,
    statusHistory: history,
    dirtyRecords,
    returns,
    keyEvents: extractKeyEvents(history),
    totalQuoteAmount: quoteTotal ? quoteTotal.total : 0,
    inspectionCount: batchData.inspection_count,
    quoteCount: batchData.quote_count,
    photoCount: batchData.photo_count,
    scanCount: batchData.scan_count,
    returnCount: batchData.return_count
  };
}

function extractKeyEvents(history) {
  return history.map(h => ({
    time: h.created_at,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    operator: h.operator_name,
    reason: h.reason
  }));
}

function exportBatchToCsv(batchId) {
  const summary = generateBatchSummary(batchId);
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `batch_${summary.batch.batch_no}_${timestamp}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'field', title: '项目' },
      { id: 'value', title: '内容' }
    ]
  });

  const records = [
    { field: '批次号', value: summary.batch.batch_no },
    { field: 'VIN码', value: summary.batch.vin },
    { field: '车牌号', value: summary.batch.plate_number || '-' },
    { field: '车型', value: summary.batch.car_model || '-' },
    { field: '当前状态', value: summary.batch.status },
    { field: '返厂次数', value: summary.batch.current_return_count },
    { field: '总金额', value: summary.batch.total_amount || 0 },
    { field: '录入人', value: summary.batch.entry_user_name || '-' },
    { field: '录入时间', value: summary.batch.created_at },
    { field: '', value: '' },
    { field: '=== 状态流转记录 ===', value: '' },
    { field: '时间', value: '状态变更 | 操作人 | 原因' }
  ];

  summary.keyEvents.forEach((event, index) => {
    records.push({
      field: `${index + 1}. ${event.time}`,
      value: `${event.fromStatus || '初始'} → ${event.toStatus} | ${event.operator || '-'} | ${event.reason || '-'}`
    });
  });

  if (summary.batch.status === 'frozen') {
    records.push(
      { field: '', value: '' },
      { field: '=== 冻结信息 ===', value: '' },
      { field: '冻结前状态', value: summary.batch.frozen_status },
      { field: '冻结原因', value: summary.batch.freeze_reason },
      { field: '冻结时间', value: summary.batch.freeze_time }
    );
  }

  if (summary.returns.length > 0) {
    records.push(
      { field: '', value: '' },
      { field: '=== 返厂记录 ===', value: '' },
      { field: '序号 | 返厂原因 | 责任人 | 额外费用 | 日期', value: '' }
    );
    summary.returns.forEach(r => {
      records.push({
        field: `第${r.return_number}次返厂`,
        value: `${r.return_reason || '-'} | ${r.responsible_person || '-'} | ${r.additional_cost || 0} | ${r.return_date || '-'}`
      });
    });
  }

  if (summary.dirtyRecords.length > 0) {
    records.push(
      { field: '', value: '' },
      { field: '=== 脏记录 ===', value: '' },
      { field: '类型 | 字段 | 状态 | 处理人', value: '' }
    );
    summary.dirtyRecords.forEach(dr => {
      records.push({
        field: `${dr.error_type}`,
        value: `${dr.field_name || '-'} | ${dr.status} | ${dr.handler_name || '-'}`
      });
    });
  }

  csvWriter.writeRecords(records);
  return { filePath, fileName };
}

function exportBatchesSummaryToCsv(filters = {}) {
  const conditions = [];
  const params = [];
  
  if (filters.status) {
    conditions.push('b.status = ?');
    params.push(filters.status);
  }
  if (filters.startDate) {
    conditions.push('DATE(b.created_at) >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('DATE(b.created_at) <= ?');
    params.push(filters.endDate);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const batches = all(`
    SELECT b.*,
           u1.real_name as entry_user_name,
           (SELECT COUNT(*) FROM status_history WHERE batch_id = b.id) as history_count,
           (SELECT COUNT(*) FROM dirty_records WHERE batch_id = b.id) as dirty_count
    FROM batches b
    LEFT JOIN users u1 ON b.entry_user_id = u1.id
    ${whereClause}
    ORDER BY b.created_at DESC
  `, params);

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `batches_summary_${timestamp}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'batch_no', title: '批次号' },
      { id: 'vin', title: 'VIN码' },
      { id: 'plate_number', title: '车牌号' },
      { id: 'car_model', title: '车型' },
      { id: 'status', title: '状态' },
      { id: 'current_return_count', title: '返厂次数' },
      { id: 'total_amount', title: '总金额' },
      { id: 'frozen_status', title: '冻结前状态' },
      { id: 'freeze_reason', title: '冻结原因' },
      { id: 'freeze_time', title: '冻结时间' },
      { id: 'entry_user_name', title: '录入人' },
      { id: 'dirty_count', title: '脏记录数' },
      { id: 'created_at', title: '创建时间' }
    ]
  });

  csvWriter.writeRecords(batches);
  return { filePath, fileName };
}

function getExportFile(fileName) {
  const filePath = path.join(EXPORT_DIR, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

module.exports = {
  generateBatchSummary,
  exportBatchToCsv,
  exportBatchesSummaryToCsv,
  getExportFile,
  EXPORT_DIR
};
