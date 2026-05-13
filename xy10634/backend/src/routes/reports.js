const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { Database } = require('../utils/db');

router.get('/logs', async (req, res) => {
  try {
    const { operator, start_date, end_date, entity_type } = req.query;
    
    let query = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (operator) {
      query += ' AND operator = ?';
      params.push(operator);
    }
    if (start_date) {
      query += ' AND operation_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND operation_time <= ?';
      params.push(end_date + ' 23:59:59');
    }
    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }
    
    query += ' ORDER BY operation_time DESC';
    
    const logs = await Database.all(query, ...params);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/reschedule', async (req, res) => {
  try {
    const { requested_by, reviewed_by, start_date, end_date, status } = req.query;
    
    let query = `
      SELECT r.*, o.order_number, o.customer_name, o.quantity,
             f.name as recipe_name
      FROM reschedule_requests r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN flavor_recipes f ON o.recipe_id = f.id
      WHERE 1=1
    `;
    const params = [];
    
    if (requested_by) {
      query += ' AND r.requested_by = ?';
      params.push(requested_by);
    }
    if (reviewed_by) {
      query += ' AND r.reviewed_by = ?';
      params.push(reviewed_by);
    }
    if (start_date) {
      query += ' AND r.requested_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND r.requested_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY r.requested_at DESC';
    
    const requests = await Database.all(query, ...params);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export/reschedule', async (req, res) => {
  try {
    const { requested_by, reviewed_by, start_date, end_date, status } = req.query;
    
    let query = `
      SELECT r.*, o.order_number, o.customer_name, o.quantity,
             f.name as recipe_name
      FROM reschedule_requests r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN flavor_recipes f ON o.recipe_id = f.id
      WHERE 1=1
    `;
    const params = [];
    
    if (requested_by) {
      query += ' AND r.requested_by = ?';
      params.push(requested_by);
    }
    if (reviewed_by) {
      query += ' AND r.reviewed_by = ?';
      params.push(reviewed_by);
    }
    if (start_date) {
      query += ' AND r.requested_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND r.requested_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY r.requested_at DESC';
    
    const requests = await Database.all(query, ...params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('改期申请报告');
    
    worksheet.columns = [
      { header: '订单号', key: 'order_number', width: 15 },
      { header: '客户姓名', key: 'customer_name', width: 15 },
      { header: '产品', key: 'recipe_name', width: 20 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '原取货时间', key: 'original_pickup_time', width: 25 },
      { header: '申请取货时间', key: 'requested_pickup_time', width: 25 },
      { header: '改期原因', key: 'reason', width: 30 },
      { header: '申请人', key: 'requested_by', width: 15 },
      { header: '申请时间', key: 'requested_at', width: 25 },
      { header: '状态', key: 'status', width: 15 },
      { header: '审核人', key: 'reviewed_by', width: 15 },
      { header: '审核时间', key: 'reviewed_at', width: 25 },
      { header: '审核备注', key: 'review_notes', width: 30 }
    ];
    
    requests.forEach(r => {
      worksheet.addRow({
        order_number: r.order_number,
        customer_name: r.customer_name,
        recipe_name: r.recipe_name,
        quantity: r.quantity,
        original_pickup_time: r.original_pickup_time,
        requested_pickup_time: r.requested_pickup_time,
        reason: r.reason,
        requested_by: r.requested_by,
        requested_at: r.requested_at,
        status: r.status,
        reviewed_by: r.reviewed_by || '',
        reviewed_at: r.reviewed_at || '',
        review_notes: r.review_notes || ''
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reschedule_report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export/changes', async (req, res) => {
  try {
    const { operator, start_date, end_date } = req.query;
    
    let query = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (operator) {
      query += ' AND operator = ?';
      params.push(operator);
    }
    if (start_date) {
      query += ' AND operation_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND operation_time <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    query += ' ORDER BY operation_time DESC';
    
    const logs = await Database.all(query, ...params);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('变更历史报告');
    
    worksheet.columns = [
      { header: '操作类型', key: 'operation_type', width: 15 },
      { header: '实体类型', key: 'entity_type', width: 20 },
      { header: '实体ID', key: 'entity_id', width: 40 },
      { header: '原值', key: 'old_value', width: 50 },
      { header: '新值', key: 'new_value', width: 50 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '操作时间', key: 'operation_time', width: 25 },
      { header: '备注', key: 'notes', width: 30 }
    ];
    
    logs.forEach(l => {
      worksheet.addRow({
        operation_type: l.operation_type,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        old_value: l.old_value || '',
        new_value: l.new_value || '',
        operator: l.operator,
        operation_time: l.operation_time,
        notes: l.notes || ''
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=change_history_report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
