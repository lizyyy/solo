const express = require('express');
const router = express.Router();
const db = require('../database');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const exportsDir = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

router.get('/export', async (req, res) => {
  const { responsible_person, start_date, end_date, report_type } = req.query;
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gift Management System';
  workbook.created = new Date();

  const inventorySheet = workbook.addWorksheet('礼品库存');
  inventorySheet.columns = [
    { header: '礼品名称', key: 'gift_name', width: 20 },
    { header: '礼品类型', key: 'gift_type', width: 15 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '单位', key: 'unit', width: 10 },
    { header: '单价', key: 'unit_price', width: 10 },
    { header: '供应商', key: 'supplier', width: 20 },
    { header: '备注', key: 'remarks', width: 30 },
    { header: '创建时间', key: 'created_at', width: 20 }
  ];

  const inventoryData = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM gift_inventory ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  inventorySheet.addRows(inventoryData);

  const plansSheet = workbook.addWorksheet('活动计划');
  plansSheet.columns = [
    { header: '计划名称', key: 'plan_name', width: 25 },
    { header: '开始日期', key: 'start_date', width: 15 },
    { header: '结束日期', key: 'end_date', width: 15 },
    { header: '礼品类型', key: 'gift_type', width: 15 },
    { header: '总数量', key: 'total_quantity', width: 10 },
    { header: '预算', key: 'budget', width: 10 },
    { header: '责任人', key: 'responsible_person', width: 15 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  let plansQuery = 'SELECT * FROM activity_plans WHERE 1=1';
  let plansParams = [];
  
  if (responsible_person) {
    plansQuery += ' AND responsible_person LIKE ?';
    plansParams.push(`%${responsible_person}%`);
  }
  if (start_date) {
    plansQuery += ' AND start_date >= ?';
    plansParams.push(start_date);
  }
  if (end_date) {
    plansQuery += ' AND end_date <= ?';
    plansParams.push(end_date);
  }
  plansQuery += ' ORDER BY created_at DESC';

  const plansData = await new Promise((resolve, reject) => {
    db.all(plansQuery, plansParams, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  plansSheet.addRows(plansData);

  const customersSheet = workbook.addWorksheet('客户名单');
  customersSheet.columns = [
    { header: '客户姓名', key: 'customer_name', width: 15 },
    { header: '电话', key: 'phone', width: 15 },
    { header: '地址', key: 'address', width: 30 },
    { header: '礼品类型', key: 'gift_type', width: 15 },
    { header: '礼品数量', key: 'gift_quantity', width: 10 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  const customersData = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM customer_lists ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  customersSheet.addRows(customersData);

  const claimsSheet = workbook.addWorksheet('员工领用');
  claimsSheet.columns = [
    { header: '员工姓名', key: 'employee_name', width: 15 },
    { header: '部门', key: 'department', width: 15 },
    { header: '礼品类型', key: 'gift_type', width: 15 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '领用日期', key: 'claim_date', width: 15 },
    { header: '用途', key: 'purpose', width: 20 },
    { header: '审批人', key: 'approver', width: 15 },
    { header: '状态', key: 'status', width: 10 }
  ];

  const claimsData = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM employee_claims ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  claimsSheet.addRows(claimsData);

  const expressSheet = workbook.addWorksheet('快递单号');
  expressSheet.columns = [
    { header: '快递单号', key: 'tracking_number', width: 25 },
    { header: '快递公司', key: 'express_company', width: 15 },
    { header: '发件人', key: 'sender', width: 15 },
    { header: '发件日期', key: 'send_date', width: 15 },
    { header: '收件日期', key: 'receive_date', width: 15 },
    { header: '状态', key: 'status', width: 10 }
  ];

  const expressData = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM express_orders ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  expressSheet.addRows(expressData);

  const returnsSheet = workbook.addWorksheet('退回入库');
  returnsSheet.columns = [
    { header: '礼品类型', key: 'gift_type', width: 15 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '退回原因', key: 'return_reason', width: 30 },
    { header: '退回日期', key: 'return_date', width: 15 },
    { header: '处理人', key: 'handler', width: 15 },
    { header: '来源类型', key: 'source_type', width: 15 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  let returnsQuery = 'SELECT * FROM return_inventory WHERE 1=1';
  let returnsParams = [];
  
  if (responsible_person) {
    returnsQuery += ' AND handler LIKE ?';
    returnsParams.push(`%${responsible_person}%`);
  }
  if (start_date) {
    returnsQuery += ' AND return_date >= ?';
    returnsParams.push(start_date);
  }
  if (end_date) {
    returnsQuery += ' AND return_date <= ?';
    returnsParams.push(end_date);
  }
  returnsQuery += ' ORDER BY created_at DESC';

  const returnsData = await new Promise((resolve, reject) => {
    db.all(returnsQuery, returnsParams, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  returnsSheet.addRows(returnsData);

  const exceptionsSheet = workbook.addWorksheet('异常记录');
  exceptionsSheet.columns = [
    { header: '异常类型', key: 'exception_type', width: 15 },
    { header: '相关模块', key: 'related_module', width: 15 },
    { header: '原因', key: 'reason', width: 30 },
    { header: '修改前值', key: 'before_value', width: 20 },
    { header: '修改后值', key: 'after_value', width: 20 },
    { header: '处理人', key: 'handler', width: 15 },
    { header: '处理时间', key: 'handle_time', width: 20 },
    { header: '状态', key: 'status', width: 10 }
  ];

  const exceptionsData = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM exception_records ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  exceptionsSheet.addRows(exceptionsData);

  const fileName = `gift_report_${new Date().getTime()}.xlsx`;
  const filePath = path.join(exportsDir, fileName);
  
  await workbook.xlsx.writeFile(filePath);
  
  res.json({ 
    success: true, 
    download_url: `/exports/${fileName}`,
    file_name: fileName
  });
});

router.get('/summary', (req, res) => {
  const summary = {};
  
  db.get('SELECT COUNT(*) as total, SUM(quantity * unit_price) as total_value FROM gift_inventory', (err, row) => {
    summary.inventory_value = row;
    
    db.get('SELECT COUNT(*) as total_plans, SUM(budget) as total_budget FROM activity_plans', (err, row) => {
      summary.plans_summary = row;
      
      db.all('SELECT status, COUNT(*) as count FROM customer_lists GROUP BY status', (err, rows) => {
        summary.customer_status = rows;
        
        db.get('SELECT COUNT(*) as pending_count FROM exception_records WHERE status = "pending"', (err, row) => {
          summary.pending_exceptions = row;
          
          res.json({ data: summary });
        });
      });
    });
  });
});

module.exports = router;
