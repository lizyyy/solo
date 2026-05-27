const fs = require('fs');
const path = require('path');

const code = `const db = require('./database');

const CATEGORIES = {
  NORMAL: '正常',
  PENDING_SUPPLEMENT: '待补充',
  BLOCKED: '已拦截'
};

function validateItem(item, rowIndex) {
  const errors = [];
  const requiredFields = ['waybill_no', 'receiver_name', 'receiver_phone', 'detained_at'];
  
  requiredFields.forEach(field => {
    if (!item[field] || String(item[field]).trim() === '') {
      errors.push({
        row_index: rowIndex,
        field_name: field,
        error_type: 'missing_field',
        error_message: '必填字段缺失: ' + field
      });
    }
  });

  if (item.detained_at && item.expected_pickup_at) {
    const detained = new Date(item.detained_at);
    const expected = new Date(item.expected_pickup_at);
    if (detained > expected) {
      errors.push({
        row_index: rowIndex,
        field_name: 'expected_pickup_at',
        error_type: 'time_conflict',
        error_message: '预计自取时间早于滞留时间'
      });
    }
  }

  if (item.waybill_no && !/^[A-Z0-9]{8,20}$/i.test(item.waybill_no)) {
    errors.push({
      row_index: rowIndex,
      field_name: 'waybill_no',
      error_type: 'invalid_format',
      error_message: '运单号格式不正确，应为8-20位字母数字组合'
    });
  }

  if (item.receiver_phone && !/^1[3-9]\\d{9}$/.test(item.receiver_phone)) {
    errors.push({
      row_index: rowIndex,
      field_name: 'receiver_phone',
      error_type: 'invalid_format',
      error_message: '手机号格式不正确，应为11位有效手机号'
    });
  }

  return errors;
}

function classifyItem(item, hasErrors) {
  if (hasErrors) {
    const missingFields = ['waybill_no', 'receiver_name', 'receiver_phone', 'detained_at']
      .filter(f => !item[f] || String(item[f]).trim() === '');
    
    if (missingFields.length > 0) {
      return {
        category: CATEGORIES.PENDING_SUPPLEMENT,
        reason_code: 'MISSING_INFO',
        reason_desc: '缺少必要信息: ' + missingFields.join('、'),
        action_required: '请补充收件人完整信息后重新提交',
        action_deadline: calculateDeadline(3)
      };
    }

    const timeErrors = item.detained_at && item.expected_pickup_at && 
      new Date(item.detained_at) > new Date(item.expected_pickup_at);
    if (timeErrors) {
      return {
        category: CATEGORIES.BLOCKED,
        reason_code: 'TIME_CONFLICT',
        reason_desc: '时间逻辑冲突：滞留时间晚于预计自取时间',
        action_required: '请核对并修正滞留时间和预计自取时间',
        action_deadline: null
      };
    }
  }

  if (item.remark && item.remark.includes('拦截')) {
    return {
      category: CATEGORIES.BLOCKED,
      reason_code: 'USER_BLOCKED',
      reason_desc: '用户备注要求拦截',
      action_required: '已按用户要求拦截，等待进一步处理指令',
      action_deadline: null
    };
  }

  if (item.detained_at) {
    const detainedDays = Math.floor((Date.now() - new Date(item.detained_at).getTime()) / (1000 * 60 * 60 * 24));
    if (detainedDays > 7) {
      return {
        category: CATEGORIES.PENDING_SUPPLEMENT,
        reason_code: 'OVERDUE_7DAYS',
        reason_desc: '快件已滞留 ' + detainedDays + ' 天，超过7天预警期',
        action_required: '建议联系收件人催促自取，或安排退回',
        action_deadline: calculateDeadline(2)
      };
    }
  }

  return {
    category: CATEGORIES.NORMAL,
    reason_code: 'NORMAL_PROCESS',
    reason_desc: '信息完整，符合正常处理流程',
    action_required: '按正常流程等待收件人自取',
    action_deadline: item.expected_pickup_at || calculateDeadline(5)
  };
}

function calculateDeadline(days) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline.toISOString().split('T')[0];
}

function saveFieldTrace(itemId, item) {
  const traceFields = ['waybill_no', 'receiver_name', 'receiver_phone', 'detained_at', 'storage_location'];
  const insertTrace = db.prepare('INSERT INTO field_trace (item_id, field_name, original_value, final_value, transformation_steps) VALUES (?, ?, ?, ?, ?)');

  traceFields.forEach(field => {
    insertTrace.run(
      itemId,
      field,
      item[field] || null,
      item[field] || null,
      JSON.stringify([{ step: 'raw_input', value: item[field] || null }])
    );
  });
}

function processBatch(batchId, items) {
  const insertItem = db.prepare('INSERT INTO detention_items (id, batch_id, row_index, waybill_no, receiver_name, receiver_phone, detained_at, expected_pickup_at, parcel_type, storage_location, remark, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const insertResult = db.prepare('INSERT INTO classification_results (item_id, batch_id, category, reason_code, reason_desc, action_required, action_deadline) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const insertError = db.prepare('INSERT INTO validation_errors (batch_id, item_id, row_index, field_name, error_type, error_message) VALUES (?, ?, ?, ?, ?, ?)');

  const waybillMap = new Map();
  const results = [];

  items.forEach((item, index) => {
    const rowIndex = index + 1;
    const itemId = batchId + '-' + rowIndex;

    insertItem.run(
      itemId, batchId, rowIndex,
      item.waybill_no || null,
      item.receiver_name || null,
      item.receiver_phone || null,
      item.detained_at || null,
      item.expected_pickup_at || null,
      item.parcel_type || null,
      item.storage_location || null,
      item.remark || null,
      JSON.stringify(item)
    );

    const errors = validateItem(item, rowIndex);

    if (item.waybill_no) {
      if (waybillMap.has(item.waybill_no)) {
        errors.push({
          row_index: rowIndex,
          field_name: 'waybill_no',
          error_type: 'duplicate_waybill',
          error_message: '运单号重复，与第 ' + waybillMap.get(item.waybill_no) + ' 行重复'
        });
      } else {
        waybillMap.set(item.waybill_no, rowIndex);
      }
    }

    errors.forEach(err => {
      insertError.run(batchId, itemId, err.row_index, err.field_name, err.error_type, err.error_message);
    });

    const classification = classifyItem(item, errors.length > 0);
    insertResult.run(
      itemId, batchId,
      classification.category,
      classification.reason_code,
      classification.reason_desc,
      classification.action_required,
      classification.action_deadline
    );

    saveFieldTrace(itemId, item);

    results.push({
      row_index: rowIndex,
      item_id: itemId,
      waybill_no: item.waybill_no,
      category: classification.category,
      reason_code: classification.reason_code,
      reason_desc: classification.reason_desc,
      action_required: classification.action_required,
      action_deadline: classification.action_deadline,
      errors: errors
    });
  });

  return results;
}

module.exports = {
  CATEGORIES: CATEGORIES,
  validateItem: validateItem,
  classifyItem: classifyItem,
  processBatch: processBatch
};
`;

const targetPath = path.join(__dirname, 'src', 'classifier.js');
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Written to:', targetPath);
console.log('Size:', fs.statSync(targetPath).size, 'bytes');
console.log('Lines:', code.split('\\n').length);