const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../config/store');
const { ORDER_STATUS, CHECKPOINT_TYPE, CHECKPOINT_STATUS } = require('../config/constants');
const {
  getOrderByNo,
  updateOrderStatus,
  recordCheckpoint,
  getOrderDocuments,
  recordManualCorrection
} = require('../services/orderService');
const rules = require('../services/rules');

router.post('/verify', (req, res) => {
  const { order_no, doc_type, doc_url, verified_by, idempotent_key } = req.body;

  if (!order_no || !doc_type) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'doc_type']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const idempotentKey = idempotent_key || `doc_verify_${order_no}_${doc_type}`;
  const checkpointResult = recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.DOCUMENT,
    CHECKPOINT_STATUS.PENDING,
    false,
    {},
    idempotentKey,
    verified_by || 'system'
  );

  if (checkpointResult.isDuplicate) {
    return res.json({
      success: true,
      isDuplicate: true,
      message: '证件校验请求已处理，幂等性保护',
      data: { checkpoint: checkpointResult.checkpoint }
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const verificationResults = [];
  let allValid = true;

  if (doc_type === 'id_card' || doc_type === 'all') {
    const idCheck = rules.validateIdCard(order.receiver_id_number);
    const expiryCheck = order.receiver_id_expiry_date 
      ? rules.validateIdExpiry(order.receiver_id_expiry_date)
      : { valid: false, reason: '证件有效期未提供' };

    if (idCheck.valid && expiryCheck.valid) {
      store.insert('documents', {
        id: uuidv4(),
        order_id: order.id,
        doc_type: 'id_photo',
        doc_url: doc_url || null,
        doc_hash: null,
        verified_status: 'passed',
        verified_by: verified_by || 'system',
        verified_at: now,
        verified_remark: '身份证校验通过',
        is_valid: 1,
        expiry_date: order.receiver_id_expiry_date,
        created_at: now
      });
      verificationResults.push({ type: 'id_card', valid: true, message: '身份证校验通过' });
    } else {
      allValid = false;
      const failReason = !idCheck.valid ? idCheck.reason : expiryCheck.reason;
      store.insert('documents', {
        id: uuidv4(),
        order_id: order.id,
        doc_type: 'id_photo',
        doc_url: doc_url || null,
        doc_hash: null,
        verified_status: 'failed',
        verified_by: verified_by || 'system',
        verified_at: now,
        verified_remark: failReason,
        is_valid: 0,
        expiry_date: order.receiver_id_expiry_date,
        created_at: now
      });
      verificationResults.push({ type: 'id_card', valid: false, message: failReason });
    }
  }

  if (doc_type === 'commercial_invoice' || doc_type === 'all') {
    verificationResults.push({ type: 'commercial_invoice', valid: doc_url ? true : false, message: doc_url ? '商业发票已提供' : '商业发票未提供' });
    if (!doc_url) allValid = false;
  }

  if (doc_type === 'packing_list' || doc_type === 'all') {
    verificationResults.push({ type: 'packing_list', valid: true, message: '装箱单校验通过' });
  }

  const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
  if (checkpoints.length > 0) {
    const cpId = checkpoints[checkpoints.length - 1].id;
    store.update('checkpoints', c => c.id === cpId, {
      status: allValid ? CHECKPOINT_STATUS.PASSED : CHECKPOINT_STATUS.FAILED,
      passed: allValid ? 1 : 0,
      error_message: allValid ? null : verificationResults.find(r => !r.valid)?.message,
      executed_at: now,
      details: JSON.stringify({ results: verificationResults })
    });
  }

  let newStatus = order.status;
  if (allValid) {
    updateOrderStatus(order.id, ORDER_STATUS.DOCS_VERIFIED, '证件校验通过', { verificationResults }, verified_by || 'system');
    updateOrderStatus(order.id, ORDER_STATUS.TAXCODE_PENDING, '等待税号校验', null, verified_by || 'system');
    newStatus = ORDER_STATUS.TAXCODE_PENDING;
  }

  res.json({
    success: true,
    message: allValid ? '证件校验通过' : '证件校验存在问题',
    data: {
      order_no,
      all_valid: allValid,
      status: newStatus,
      verification_results: verificationResults
    }
  });
});

router.post('/manual-correct', (req, res) => {
  const { order_no, field_name, old_value, new_value, corrected_by, correction_reason } = req.body;

  if (!order_no || !field_name || !new_value || !corrected_by) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'field_name', 'new_value', 'corrected_by']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const actualOldValue = order[field_name] !== undefined ? order[field_name] : old_value;

  recordManualCorrection(order.id, field_name, actualOldValue, new_value, corrected_by, correction_reason);

  const allowedFields = ['receiver_id_number', 'receiver_id_expiry_date', 'receiver_name', 'receiver_phone', 'remark'];
  if (allowedFields.includes(field_name)) {
    store.update('orders', o => o.id === order.id, {
      [field_name]: new_value,
      updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  res.json({
    success: true,
    message: '人工修正记录已保存',
    data: {
      order_no,
      field_name,
      old_value: actualOldValue,
      new_value,
      corrected_by,
      corrected_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      diff: {
        before: actualOldValue,
        after: new_value
      }
    }
  });
});

module.exports = router;
