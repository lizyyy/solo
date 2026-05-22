const express = require('express');
const router = express.Router();
const dbHelper = require('../utils/db-helper');
const { detectDirtyRecords } = require('../utils/dirty-detector');
const { v4: uuidv4 } = require('uuid');

router.post('/orders', async (req, res) => {
  try {
    const { resident_id, resident_name, room_no, repair_type, description, screenshot_url, report_time } = req.body;
    
    if (!resident_id || !report_time) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const order_no = 'ORD-' + uuidv4().substr(0, 8).toUpperCase();

    const orderData = {
      order_no,
      resident_id,
      resident_name,
      room_no,
      repair_type,
      description,
      screenshot_url,
      report_time,
      status: 'pending'
    };

    const dirtyRecords = await detectDirtyRecords('repair_order', orderData);

    const sql = `
      INSERT INTO repair_orders 
      (order_no, resident_id, resident_name, room_no, repair_type, description, screenshot_url, report_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      order_no, resident_id, resident_name, room_no, repair_type, description, screenshot_url, report_time, 'pending'
    ]);

    await dbHelper.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after_data, operator, remark)
       VALUES ('create', 'repair_order', ?, ?, ?, '创建报修单')`,
      [order_no, JSON.stringify(orderData), req.body.operator || 'system']
    );

    res.json({
      success: true,
      data: {
        order_no,
        dirty_count: dirtyRecords.length,
        dirty_records: dirtyRecords
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let sql = 'SELECT * FROM repair_orders';
    let params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY report_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const orders = await dbHelper.all(sql, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/:orderNo', async (req, res) => {
  try {
    const order = await dbHelper.get(
      'SELECT * FROM repair_orders WHERE order_no = ?',
      [req.params.orderNo]
    );
    if (!order) {
      return res.status(404).json({ error: '报修单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/receipts', async (req, res) => {
  try {
    const { order_no, repairman_id, repairman_name, arrival_time, complete_time,
      repair_content, is_rework, is_part_replacement, receipt_image_url, labor_fee } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: '缺少报修单号' });
    }

    const receipt_no = 'RCT-' + uuidv4().substr(0, 8).toUpperCase();
    
    const receiptData = {
      receipt_no,
      order_no,
      repairman_id,
      repairman_name,
      arrival_time,
      complete_time,
      repair_content,
      is_rework: is_rework ? 1 : 0,
      is_part_replacement: is_part_replacement ? 1 : 0,
      receipt_image_url,
      labor_fee: labor_fee || 0,
      status: 'completed'
    };

    const dirtyRecords = await detectDirtyRecords('receipt', receiptData);

    const sql = `
      INSERT INTO repair_receipts
      (receipt_no, order_no, repairman_id, repairman_name, arrival_time, complete_time,
       repair_content, is_rework, is_part_replacement, receipt_image_url, labor_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      receipt_no, order_no, repairman_id, repairman_name, arrival_time, complete_time,
      repair_content, is_rework ? 1 : 0, is_part_replacement ? 1 : 0, receipt_image_url, labor_fee || 0, 'completed'
    ]);

    await dbHelper.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after_data, operator, remark)
       VALUES ('create', 'receipt', ?, ?, ?, '创建维修回执')`,
      [receipt_no, JSON.stringify(receiptData), req.body.operator || 'system']
    );

    res.json({
      success: true,
      data: {
        receipt_no,
        dirty_count: dirtyRecords.length,
        dirty_records: dirtyRecords
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/materials', async (req, res) => {
  try {
    const { order_no, receipt_no, material_code, material_name, quantity, unit_price, total_price, receiver, receive_time } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: '缺少报修单号' });
    }

    const usage_no = 'MAT-' + uuidv4().substr(0, 8).toUpperCase();
    
    const materialData = {
      usage_no,
      order_no,
      receipt_no,
      material_code,
      material_name,
      quantity: quantity || 0,
      unit_price: unit_price || 0,
      total_price: total_price || 0,
      receiver,
      receive_time
    };

    const dirtyRecords = await detectDirtyRecords('material', materialData);

    const sql = `
      INSERT INTO material_usages
      (usage_no, order_no, receipt_no, material_code, material_name, quantity, unit_price, total_price, receiver, receive_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      usage_no, order_no, receipt_no, material_code, material_name,
      quantity || 0, unit_price || 0, total_price || 0, receiver, receive_time
    ]);

    await dbHelper.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after_data, operator, remark)
       VALUES ('create', 'material', ?, ?, ?, '创建材料领用')`,
      [usage_no, JSON.stringify(materialData), req.body.operator || 'system']
    );

    res.json({
      success: true,
      data: {
        usage_no,
        dirty_count: dirtyRecords.length,
        dirty_records: dirtyRecords
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refunds', async (req, res) => {
  try {
    const { order_no, refund_amount, refund_reason, trans_time, operator } = req.body;

    if (!order_no) {
      return res.status(400).json({ error: '缺少报修单号' });
    }

    const trans_no = 'REF-' + uuidv4().substr(0, 8).toUpperCase();
    
    const refundData = {
      trans_no,
      order_no,
      refund_amount: refund_amount || 0,
      refund_reason,
      trans_time,
      operator,
      status: 'completed'
    };

    const dirtyRecords = await detectDirtyRecords('refund', refundData);

    const sql = `
      INSERT INTO refund_transactions
      (trans_no, order_no, refund_amount, refund_reason, trans_time, operator, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      trans_no, order_no, refund_amount || 0, refund_reason, trans_time, operator, 'completed'
    ]);

    await dbHelper.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after_data, operator, remark)
       VALUES ('create', 'refund', ?, ?, ?, '创建退款流水')`,
      [trans_no, JSON.stringify(refundData), req.body.operator || 'system']
    );

    res.json({
      success: true,
      data: {
        trans_no,
        dirty_count: dirtyRecords.length,
        dirty_records: dirtyRecords
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
