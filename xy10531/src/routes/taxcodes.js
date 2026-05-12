const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../config/store');
const { ORDER_STATUS, CHECKPOINT_TYPE, CHECKPOINT_STATUS } = require('../config/constants');
const {
  getOrderByNo,
  getOrderItems,
  updateOrderStatus,
  recordCheckpoint,
  recordManualCorrection
} = require('../services/orderService');
const rules = require('../services/rules');

router.get('/tax-codes', (req, res) => {
  const taxCodes = store.findMany('tax_codes', t => t.is_active === 1);
  res.json({ success: true, data: taxCodes });
});

router.post('/tax-codes', (req, res) => {
  const { tax_code, category_code, category_name, description, tax_rate, created_by } = req.body;

  if (!tax_code || !category_code || !category_name) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['tax_code', 'category_code', 'category_name']
    });
  }

  const existing = store.findOne('tax_codes', t => t.tax_code === tax_code);
  if (existing) {
    return res.status(409).json({ success: false, message: '税号已存在', tax_code });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  store.insert('tax_codes', {
    id: uuidv4(),
    tax_code,
    category_code,
    category_name,
    description: description || null,
    tax_rate: tax_rate || 0,
    is_active: 1,
    created_at: now,
    updated_at: now
  });

  res.json({
    success: true,
    message: '税号创建成功',
    data: { tax_code, category_code, category_name, tax_rate }
  });
});

router.put('/tax-codes/:taxCode', (req, res) => {
  const { category_code, category_name, description, tax_rate, is_active, updated_by } = req.body;
  const taxCode = req.params.taxCode;

  const existing = store.findOne('tax_codes', t => t.tax_code === taxCode);
  if (!existing) {
    return res.status(404).json({ success: false, message: '税号不存在' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updates = { updated_at: now };
  if (category_code !== undefined) updates.category_code = category_code;
  if (category_name !== undefined) updates.category_name = category_name;
  if (description !== undefined) updates.description = description;
  if (tax_rate !== undefined) updates.tax_rate = tax_rate;
  if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;
  
  store.update('tax_codes', t => t.tax_code === taxCode, updates);

  const updated = store.findOne('tax_codes', t => t.tax_code === taxCode);
  res.json({ success: true, message: '税号更新成功', data: updated });
});

router.post('/verify', (req, res) => {
  const { order_no, idempotent_key, verified_by } = req.body;

  if (!order_no) {
    return res.status(400).json({ success: false, message: '缺少订单号' });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const idempotentKey = idempotent_key || `tax_verify_${order_no}`;
  const checkpointResult = recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.TAXCODE,
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
      message: '税号校验请求已处理，幂等性保护',
      data: { checkpoint: checkpointResult.checkpoint }
    });
  }

  const items = getOrderItems(order.id);
  const validTaxCodes = store.findMany('tax_codes');
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const verificationResults = items.map((item, index) => {
    if (!item.tax_code) {
      return {
        item_index: index,
        sku_code: item.sku_code,
        product_name: item.product_name,
        valid: false,
        reason: '税号缺失'
      };
    }

    const formatCheck = rules.validateTaxCodeFormat(item.tax_code);
    if (!formatCheck.valid) {
      return {
        item_index: index,
        sku_code: item.sku_code,
        product_name: item.product_name,
        valid: false,
        reason: formatCheck.reason
      };
    }

    const categoryCheck = rules.validateTaxCodeCategory(item.tax_code, item.category_code, validTaxCodes);
    return {
      item_index: index,
      sku_code: item.sku_code,
      product_name: item.product_name,
      tax_code: item.tax_code,
      category_code: item.category_code,
      valid: categoryCheck.valid,
      reason: categoryCheck.valid ? '税号校验通过' : categoryCheck.reason,
      expected_category: categoryCheck.expectedCategory
    };
  });

  const allValid = verificationResults.every(r => r.valid);

  const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
  if (checkpoints.length > 0) {
    const cpId = checkpoints[checkpoints.length - 1].id;
    store.update('checkpoints', c => c.id === cpId, {
      status: allValid ? CHECKPOINT_STATUS.PASSED : CHECKPOINT_STATUS.FAILED,
      passed: allValid ? 1 : 0,
      error_message: allValid ? null : verificationResults.find(r => !r.valid)?.reason,
      executed_at: now,
      details: JSON.stringify({ results: verificationResults })
    });
  }

  let newStatus = order.status;
  if (allValid) {
    updateOrderStatus(order.id, ORDER_STATUS.TAXCODE_VERIFIED, '税号校验通过', { verificationResults }, verified_by || 'system');
    updateOrderStatus(order.id, ORDER_STATUS.PRECHECK_PENDING, '等待清关预检', null, verified_by || 'system');
    newStatus = ORDER_STATUS.PRECHECK_PENDING;
  }

  res.json({
    success: true,
    message: allValid ? '税号校验全部通过' : '税号校验存在问题',
    data: {
      order_no,
      all_valid: allValid,
      status: newStatus,
      item_results: verificationResults
    }
  });
});

router.post('/update-item-tax', (req, res) => {
  const { order_no, sku_code, tax_code, category_code, updated_by, update_reason } = req.body;

  if (!order_no || !sku_code || !tax_code) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'sku_code', 'tax_code']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const item = store.findOne('order_items', i => i.order_id === order.id && i.sku_code === sku_code);
  if (!item) {
    return res.status(404).json({ success: false, message: '商品不存在' });
  }

  recordManualCorrection(
    order.id,
    `items[${sku_code}].tax_code`,
    item.tax_code,
    tax_code,
    updated_by || 'system',
    update_reason || '人工修正税号'
  );

  const updates = { tax_code };
  if (category_code) updates.category_code = category_code;
  
  store.update('order_items', i => i.order_id === order.id && i.sku_code === sku_code, updates);

  res.json({
    success: true,
    message: '商品税号已更新',
    data: {
      order_no,
      sku_code,
      old_tax_code: item.tax_code,
      new_tax_code: tax_code,
      diff: { before: item.tax_code, after: tax_code }
    }
  });
});

module.exports = router;
