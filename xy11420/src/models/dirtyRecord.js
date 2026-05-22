const { run, get, all } = require('../db');

const ERROR_TYPES = {
  MISSING_FIELD: 'missing_field',
  CROSS_DAY: 'cross_day',
  NAME_MISMATCH: 'name_mismatch',
  AMOUNT_CONFLICT: 'amount_conflict',
  QUANTITY_CONFLICT: 'quantity_conflict',
  DUPLICATE: 'duplicate'
};

const SOURCE_TYPES = {
  INSPECTION: 'inspection',
  REPAIR_QUOTE: 'repair_quote',
  PHOTO: 'photo',
  SCAN: 'scan'
};

function createDirtyRecord(data) {
  const result = run(
    `INSERT INTO dirty_records 
     (batch_id, source_type, error_type, field_name, expected_value, 
      actual_value, raw_content, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [data.batch_id, data.source_type, data.error_type, data.field_name,
     data.expected_value, data.actual_value, data.raw_content]
  );
  
  return get('SELECT * FROM dirty_records WHERE id = ?', [result.lastID]);
}

function getDirtyRecord(id) {
  return get(
    `SELECT dr.*, u.real_name as handler_name
     FROM dirty_records dr
     LEFT JOIN users u ON dr.handler_id = u.id
     WHERE dr.id = ?`,
    [id]
  );
}

function listDirtyRecords(filters = {}, page = 1, pageSize = 20) {
  const conditions = [];
  const params = [];
  
  if (filters.batch_id) {
    conditions.push('dr.batch_id = ?');
    params.push(filters.batch_id);
  }
  if (filters.status) {
    conditions.push('dr.status = ?');
    params.push(filters.status);
  }
  if (filters.error_type) {
    conditions.push('dr.error_type = ?');
    params.push(filters.error_type);
  }
  if (filters.source_type) {
    conditions.push('dr.source_type = ?');
    params.push(filters.source_type);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const total = get(
    `SELECT COUNT(*) as count FROM dirty_records dr ${whereClause}`,
    params
  );
  
  const offset = (page - 1) * pageSize;
  const items = all(
    `SELECT dr.*, u.real_name as handler_name
     FROM dirty_records dr
     LEFT JOIN users u ON dr.handler_id = u.id
     ${whereClause}
     ORDER BY dr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  
  return {
    items,
    total: total.count,
    page,
    pageSize
  };
}

function resolveDirtyRecord(id, handlerId, handlingOpinion, status = 'resolved') {
  run(
    `UPDATE dirty_records 
     SET status = ?, handler_id = ?, handling_opinion = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, handlerId, handlingOpinion, id]
  );
  
  return getDirtyRecord(id);
}

function validateInspectionData(data, existingRecords = []) {
  const errors = [];
  const orderNo = data.order_no || data.order_number;
  
  if (!orderNo) {
    errors.push({
      source_type: 'inspection',
      error_type: 'missing_field',
      field_name: 'order_no',
      actual_value: null,
      raw_content: JSON.stringify(data)
    });
  }
  
  if (!data.inspection_date) {
    errors.push({
      source_type: 'inspection',
      error_type: 'missing_field',
      field_name: 'inspection_date',
      actual_value: null,
      raw_content: JSON.stringify(data)
    });
  }
  
  const duplicate = existingRecords.find(r => r.order_no === orderNo);
  if (duplicate) {
    errors.push({
      source_type: 'inspection',
      error_type: 'duplicate',
      field_name: 'order_no',
      expected_value: null,
      actual_value: orderNo,
      raw_content: JSON.stringify(data)
    });
  }
  
  return errors;
}

function validateRepairQuoteData(data, existingRecords = []) {
  const errors = [];
  
  if (!data.quote_no) {
    errors.push({
      source_type: 'repair_quote',
      error_type: 'missing_field',
      field_name: 'quote_no',
      actual_value: null,
      raw_content: JSON.stringify(data)
    });
  }
  
  if (data.total_amount !== undefined && data.total_amount < 0) {
    errors.push({
      source_type: 'repair_quote',
      error_type: 'amount_conflict',
      field_name: 'total_amount',
      expected_value: '>= 0',
      actual_value: String(data.total_amount),
      raw_content: JSON.stringify(data)
    });
  }
  
  if (data.items && Array.isArray(data.items)) {
    const calculatedTotal = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    if (data.total_amount && Math.abs(calculatedTotal - data.total_amount) > 0.01) {
      errors.push({
        source_type: 'repair_quote',
        error_type: 'amount_conflict',
        field_name: 'total_amount',
        expected_value: String(calculatedTotal),
        actual_value: String(data.total_amount),
        raw_content: JSON.stringify(data)
      });
    }
  }
  
  const duplicate = existingRecords.find(r => r.quote_no === data.quote_no);
  if (duplicate) {
    errors.push({
      source_type: 'repair_quote',
      error_type: 'duplicate',
      field_name: 'quote_no',
      actual_value: data.quote_no,
      raw_content: JSON.stringify(data)
    });
  }
  
  return errors;
}

function validatePhotoData(data, existingRecords = []) {
  const errors = [];
  
  if (!data.photo_no) {
    errors.push({
      source_type: 'photo',
      error_type: 'missing_field',
      field_name: 'photo_no',
      actual_value: null,
      raw_content: JSON.stringify(data)
    });
  }
  
  const duplicate = existingRecords.find(r => r.photo_no === data.photo_no);
  if (duplicate) {
    errors.push({
      source_type: 'photo',
      error_type: 'duplicate',
      field_name: 'photo_no',
      actual_value: data.photo_no,
      raw_content: JSON.stringify(data)
    });
  }
  
  return errors;
}

function createBatchDirtyRecords(batchId, errors) {
  const records = [];
  for (const error of errors) {
    const record = createDirtyRecord({
      ...error,
      batch_id: batchId
    });
    records.push(record);
  }
  return records;
}

module.exports = {
  ERROR_TYPES,
  SOURCE_TYPES,
  createDirtyRecord,
  getDirtyRecord,
  listDirtyRecords,
  resolveDirtyRecord,
  validateInspectionData,
  validateRepairQuoteData,
  validatePhotoData,
  createBatchDirtyRecords
};
