const dbHelper = require('./db-helper');

const DIRTY_TYPES = {
  MISSING_FIELD: 'missing_field',
  CROSS_DATE: 'cross_date',
  NAME_CHANGED: 'name_changed',
  AMOUNT_CONFLICT: 'amount_conflict',
  QUANTITY_CONFLICT: 'quantity_conflict',
  DUPLICATE_ORDER: 'duplicate_order'
};

const detectDirtyRecords = async (sourceType, data) => {
  const dirtyRecords = [];

  switch (sourceType) {
    case 'repair_order':
      dirtyRecords.push(...checkRepairOrder(data));
      break;
    case 'receipt':
      dirtyRecords.push(...checkReceipt(data));
      break;
    case 'material':
      dirtyRecords.push(...checkMaterial(data));
      break;
    case 'refund':
      dirtyRecords.push(...checkRefund(data));
      break;
  }

  for (const dirty of dirtyRecords) {
    await saveDirtyRecord(dirty, sourceType, data);
  }

  return dirtyRecords;
};

const checkRepairOrder = (data) => {
  const issues = [];
  
  if (!data.resident_name || !data.room_no || !data.repair_type) {
    const missing = [];
    if (!data.resident_name) missing.push('resident_name');
    if (!data.room_no) missing.push('room_no');
    if (!data.repair_type) missing.push('repair_type');
    issues.push({
      dirty_type: DIRTY_TYPES.MISSING_FIELD,
      field_name: missing.join(','),
      error_message: '报修单缺少必填字段',
      suggestion: '补充住户姓名、房间号、报修类型'
    });
  }

  return issues;
};

const checkReceipt = (data) => {
  const issues = [];
  
  if (!data.repairman_name || !data.complete_time) {
    const missing = [];
    if (!data.repairman_name) missing.push('repairman_name');
    if (!data.complete_time) missing.push('complete_time');
    issues.push({
      dirty_type: DIRTY_TYPES.MISSING_FIELD,
      field_name: missing.join(','),
      error_message: '回执缺少必填字段',
      suggestion: '补充维修师傅姓名、完成时间'
    });
  }

  if (data.arrival_time && data.complete_time) {
    const arrival = new Date(data.arrival_time);
    const complete = new Date(data.complete_time);
    if (complete < arrival) {
      issues.push({
        dirty_type: DIRTY_TYPES.CROSS_DATE,
        field_name: 'arrival_time,complete_time',
        error_message: '完成时间早于到达时间',
        suggestion: '核对时间顺序'
      });
    }
  }

  return issues;
};

const checkMaterial = (data) => {
  const issues = [];
  
  if (!data.material_name || data.quantity <= 0) {
    const missing = [];
    if (!data.material_name) missing.push('material_name');
    if (data.quantity <= 0) missing.push('quantity');
    issues.push({
      dirty_type: DIRTY_TYPES.MISSING_FIELD,
      field_name: missing.join(','),
      error_message: '材料领用缺少必填字段或数量异常',
      suggestion: '补充材料名称，确保数量大于0'
    });
  }

  const calculatedTotal = (data.quantity || 0) * (data.unit_price || 0);
  if (data.total_price && Math.abs(calculatedTotal - data.total_price) > 0.01) {
    issues.push({
      dirty_type: DIRTY_TYPES.AMOUNT_CONFLICT,
      field_name: 'total_price',
      error_message: `总价计算不符: 计算值${calculatedTotal.toFixed(2)} ≠ 录入值${data.total_price}`,
      suggestion: '以数量×单价重新计算总价'
    });
  }

  return issues;
};

const checkRefund = (data) => {
  const issues = [];
  
  if (!data.refund_amount || data.refund_amount <= 0) {
    issues.push({
      dirty_type: DIRTY_TYPES.MISSING_FIELD,
      field_name: 'refund_amount',
      error_message: '退款金额缺失或不合法',
      suggestion: '填写大于0的退款金额'
    });
  }

  return issues;
};

const saveDirtyRecord = async (dirty, sourceType, rawData) => {
  const sql = `
    INSERT INTO dirty_records 
    (source_type, source_id, raw_content, dirty_type, field_name, error_message, suggestion, is_resolved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `;
  
  await dbHelper.run(sql, [
    sourceType,
    rawData.order_no || rawData.receipt_no || rawData.usage_no || rawData.trans_no || null,
    JSON.stringify(rawData),
    dirty.dirty_type,
    dirty.field_name,
    dirty.error_message,
    dirty.suggestion
  ]);
};

const resolveDirtyRecord = async (id, resolvedBy, resolvedNote) => {
  const sql = `
    UPDATE dirty_records 
    SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, resolved_note = ?
    WHERE id = ?
  `;
  return dbHelper.run(sql, [resolvedBy, resolvedNote, id]);
};

module.exports = {
  detectDirtyRecords,
  resolveDirtyRecord,
  DIRTY_TYPES
};
