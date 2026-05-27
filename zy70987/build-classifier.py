#!/usr/bin/env python3
import os

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'classifier.js')

CONTENT = r"""const db = require('./database');

const CATEGORIES = {
  NORMAL: '正常',
  PENDING_SUPPLEMENT: '待补充',
  BLOCKED: '已拦截'
};

function validateItem(item, rowIndex) {
  const errors = [];

  if (!item.waybill_no || String(item.waybill_no).trim() === '') {
    errors.push({
      field_name: 'waybill_no',
      error_type: 'MISSING',
      error_message: '运单号不能为空'
    });
  }

  if (!item.receiver_name || String(item.receiver_name).trim() === '') {
    errors.push({
      field_name: 'receiver_name',
      error_type: 'MISSING',
      error_message: '收件人姓名不能为空'
    });
  }

  if (!item.receiver_phone || String(item.receiver_phone).trim() === '') {
    errors.push({
      field_name: 'receiver_phone',
      error_type: 'MISSING',
      error_message: '收件人联系电话不能为空'
    });
  }

  if (!item.detained_at || String(item.detained_at).trim() === '') {
    errors.push({
      field_name: 'detained_at',
      error_type: 'MISSING',
      error_message: '滞留时间不能为空'
    });
  }

  if (item.detained_at && item.expected_pickup_at) {
    try {
      const detainedTime = new Date(item.detained_at).getTime();
      const pickupTime = new Date(item.expected_pickup_at).getTime();
      if (!isNaN(detainedTime) && !isNaN(pickupTime) && pickupTime < detainedTime) {
        errors.push({
          field_name: 'expected_pickup_at',
          error_type: 'TIME_CONFLICT',
          error_message: '预计自取时间不能早于滞留时间'
        });
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  return errors;
}

function classifyItem(item, hasErrors) {
  const hasTimeConflict = item.detained_at && item.expected_pickup_at
    ? (() => {
        try {
          const detainedTime = new Date(item.detained_at).getTime();
          const pickupTime = new Date(item.expected_pickup_at).getTime();
          return !isNaN(detainedTime) && !isNaN(pickupTime) && pickupTime < detainedTime;
        } catch (e) {
          return false;
        }
      })()
    : false;

  const missingFields = ['waybill_no', 'receiver_name', 'receiver_phone', 'detained_at']
    .filter(f => !item[f] || String(item[f]).trim() === '');

  if (hasTimeConflict) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    return {
      category: CATEGORIES.BLOCKED,
      reason_code: 'TIME_CONFLICT',
      reason_desc: '预计自取时间早于滞留时间，需拦截处理',
      action_required: '联系收件人确认或退回',
      action_deadline: deadline.toISOString()
    };
  }

  if (missingFields.length > 0) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    return {
      category: CATEGORIES.PENDING_SUPPLEMENT,
      reason_code: 'MISSING_FIELDS',
      reason_desc: '缺少必要字段: ' + missingFields.join(', ') + '，请补充',
      action_required: '补充缺失的收件人信息或运单信息',
      action_deadline: deadline.toISOString()
    };
  }

  return {
    category: CATEGORIES.NORMAL,
    reason_code: 'NORMAL',
    reason_desc: '无异常',
    action_required: null,
    action_deadline: null
  };
}

function processBatch(batchId, items) {
  const insertItem = db.prepare(`
    INSERT INTO detention_items (id, batch_id, row_index, waybill_no, receiver_name, receiver_phone, detained_at, expected_pickup_at, parcel_type, storage_location, remark, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertError = db.prepare(`
    INSERT INTO validation_errors (batch_id, item_id, row_index, field_name, error_type, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertResult = db.prepare(`
    INSERT INTO classification_results (item_id, batch_id, category, reason_code, reason_desc, action_required, action_deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTrace = db.prepare(`
    INSERT INTO field_trace (item_id, field_name, original_value, final_value, transformation_steps)
    VALUES (?, ?, ?, ?, ?)
  `);

  const results = [];

  items.forEach((item, index) => {
    const rowIndex = index + 1;
    const itemId = batchId + '_' + rowIndex;

    const errors = validateItem(item, rowIndex);
    const hasErrors = errors.length > 0;
    const classification = classifyItem(item, hasErrors);

    insertItem.run(
      itemId,
      batchId,
      rowIndex,
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

    errors.forEach(err => {
      insertError.run(
        batchId,
        itemId,
        rowIndex,
        err.field_name,
        err.error_type,
        err.error_message
      );
    });

    insertResult.run(
      itemId,
      batchId,
      classification.category,
      classification.reason_code,
      classification.reason_desc,
      classification.action_required,
      classification.action_deadline
    );

    ['waybill_no', 'receiver_name', 'receiver_phone', 'detained_at'].forEach(field => {
      const val = item[field] || '';
      insertTrace.run(
        itemId,
        field,
        val,
        val,
        JSON.stringify(['original_input'])
      );
    });

    results.push({
      row_index: rowIndex,
      item_id: itemId,
      waybill_no: item.waybill_no,
      receiver_name: item.receiver_name,
      receiver_phone: item.receiver_phone,
      detained_at: item.detained_at,
      category: classification.category,
      reason_code: classification.reason_code,
      reason_desc: classification.reason_desc,
      action_required: classification.action_required,
      action_deadline: classification.action_deadline
    });
  });

  return results;
}

module.exports = {
  CATEGORIES,
  validateItem,
  classifyItem,
  processBatch
};
"""

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write(CONTENT)

print(f'Generated {OUTPUT_PATH}')