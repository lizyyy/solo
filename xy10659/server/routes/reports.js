const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ExcelJS = require('exceljs');

router.get('/verifications', (req, res) => {
  const { start_date, end_date, handler, has_exception } = req.query;
  
  let query = `SELECT v.*, vm.plate_number, vm.vehicle_model, po.customer_name, mi.item_name 
               FROM verification_records v 
               LEFT JOIN vehicle_mileage vm ON v.vehicle_id = vm.id 
               LEFT JOIN package_orders po ON v.order_id = po.id 
               LEFT JOIN maintenance_items mi ON v.item_id = mi.id 
               WHERE 1=1`;
  const params = [];
  
  if (start_date) {
    query += ' AND v.mileage_at >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND v.mileage_at <= ?';
    params.push(end_date);
  }
  
  if (handler) {
    query += ' AND v.handler = ?';
    params.push(handler);
  }
  
  if (has_exception === 'true') {
    query += ' AND v.exception_reason IS NOT NULL';
  }
  
  query += ' ORDER BY v.created_at DESC';
  
  db.all(query, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('核销记录');
    
    worksheet.columns = [
      { header: '核销单号', key: 'verification_no', width: 20 },
      { header: '车牌号', key: 'plate_number', width: 15 },
      { header: '车型', key: 'vehicle_model', width: 20 },
      { header: '客户姓名', key: 'customer_name', width: 15 },
      { header: '保养项目', key: 'item_name', width: 20 },
      { header: '核销日期', key: 'mileage_at', width: 15 },
      { header: '实际里程', key: 'actual_mileage', width: 15 },
      { header: '补差金额', key: 'supplement_amount', width: 15 },
      { header: '总金额', key: 'total_amount', width: 15 },
      { header: '经办人', key: 'handler', width: 15 },
      { header: '异常原因', key: 'exception_reason', width: 30 },
      { header: '备注', key: 'remarks', width: 30 }
    ];
    
    worksheet.addRows(rows);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=verification_report_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/exceptions', (req, res) => {
  const { start_date, end_date, status, corrected_by } = req.query;
  
  let query = 'SELECT * FROM exceptions WHERE 1=1';
  const params = [];
  
  if (start_date) {
    query += ' AND DATE(created_at) >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND DATE(created_at) <= ?';
    params.push(end_date);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (corrected_by) {
    query += ' AND corrected_by = ?';
    params.push(corrected_by);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('异常记录');
    
    worksheet.columns = [
      { header: '异常单号', key: 'exception_no', width: 20 },
      { header: '关联类型', key: 'related_type', width: 15 },
      { header: '异常类型', key: 'exception_type', width: 20 },
      { header: '异常原因', key: 'exception_reason', width: 40 },
      { header: '经办人', key: 'handler', width: 15 },
      { header: '原值', key: 'old_value', width: 15 },
      { header: '新值', key: 'new_value', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '修正人', key: 'corrected_by', width: 15 },
      { header: '修正时间', key: 'corrected_at', width: 25 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(rows);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=exception_report_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/vehicles', (req, res) => {
  const { responsible_person } = req.query;
  
  let query = 'SELECT * FROM vehicle_mileage WHERE 1=1';
  const params = [];
  
  if (responsible_person) {
    query += ' AND responsible_person = ?';
    params.push(responsible_person);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('车辆里程');
    
    worksheet.columns = [
      { header: '车牌号', key: 'plate_number', width: 15 },
      { header: '车型', key: 'vehicle_model', width: 20 },
      { header: '当前里程', key: 'current_mileage', width: 15 },
      { header: '上次保养日期', key: 'last_maintenance_date', width: 20 },
      { header: '下次保养里程', key: 'next_maintenance_mileage', width: 20 },
      { header: '负责人', key: 'responsible_person', width: 15 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];
    
    worksheet.addRows(rows);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=vehicle_report_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router;
