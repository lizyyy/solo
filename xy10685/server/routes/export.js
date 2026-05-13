const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../database/db');
const { errorResponse } = require('../utils');

router.get('/inventory', (req, res) => {
  const { responsible_person, start_date, end_date, batch_number } = req.query;

  let sql = `SELECT ir.*, f.name as freezer_name 
             FROM inventory_records ir 
             LEFT JOIN freezers f ON ir.freezer_id = f.id 
             WHERE 1=1`;
  const params = [];

  if (responsible_person) {
    sql += ` AND (ir.operator = ? OR ir.reviewer = ?)`;
    params.push(responsible_person, responsible_person);
  }
  if (start_date) {
    sql += ` AND ir.created_at >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND ir.created_at <= ?`;
    params.push(end_date);
  }
  if (batch_number) {
    sql += ` AND ir.batch_number LIKE ?`;
    params.push(`%${batch_number}%`);
  }

  sql += ` ORDER BY ir.created_at DESC`;

  db.all(sql, params, async (err, rows) => {
    if (err) return errorResponse(res, err.message);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('盘点记录');

    worksheet.columns = [
      { header: '记录ID', key: 'id', width: 36 },
      { header: '冷柜名称', key: 'freezer_name', width: 20 },
      { header: '疫苗批号', key: 'batch_number', width: 20 },
      { header: '预期数量', key: 'expected_count', width: 12 },
      { header: '实际数量', key: 'actual_count', width: 12 },
      { header: '差异', key: 'difference', width: 10 },
      { header: '状态', key: 'status', width: 12 },
      { header: '操作人', key: 'operator', width: 12 },
      { header: '复核人', key: 'reviewer', width: 12 },
      { header: '复核时间', key: 'review_time', width: 20 },
      { header: '备注', key: 'remarks', width: 30 },
      { header: '创建时间', key: 'created_at', width: 20 }
    ];

    rows.forEach(row => worksheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/damage', (req, res) => {
  const { responsible_person, start_date, end_date, batch_number } = req.query;

  let sql = `SELECT * FROM damage_reports WHERE 1=1`;
  const params = [];

  if (responsible_person) {
    sql += ` AND (reporter = ? OR approver = ?)`;
    params.push(responsible_person, responsible_person);
  }
  if (start_date) {
    sql += ` AND created_at >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND created_at <= ?`;
    params.push(end_date);
  }
  if (batch_number) {
    sql += ` AND batch_number LIKE ?`;
    params.push(`%${batch_number}%`);
  }

  sql += ` ORDER BY created_at DESC`;

  db.all(sql, params, async (err, rows) => {
    if (err) return errorResponse(res, err.message);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('报损记录');

    worksheet.columns = [
      { header: '记录ID', key: 'id', width: 36 },
      { header: '疫苗批号', key: 'batch_number', width: 20 },
      { header: '疫苗名称', key: 'vaccine_name', width: 20 },
      { header: '报损数量', key: 'quantity', width: 12 },
      { header: '报损原因', key: 'reason', width: 30 },
      { header: '上报人', key: 'reporter', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '审批人', key: 'approver', width: 12 },
      { header: '审批时间', key: 'approval_time', width: 20 },
      { header: '审批备注', key: 'approval_remarks', width: 30 },
      { header: '创建时间', key: 'created_at', width: 20 }
    ];

    rows.forEach(row => worksheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=damage_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/history', (req, res) => {
  const { responsible_person, start_date, end_date, operation_type } = req.query;

  let sql = `SELECT * FROM operation_history WHERE 1=1`;
  const params = [];

  if (responsible_person) {
    sql += ` AND operator = ?`;
    params.push(responsible_person);
  }
  if (start_date) {
    sql += ` AND operation_time >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    sql += ` AND operation_time <= ?`;
    params.push(end_date);
  }
  if (operation_type) {
    sql += ` AND operation_type = ?`;
    params.push(operation_type);
  }

  sql += ` ORDER BY operation_time DESC`;

  db.all(sql, params, async (err, rows) => {
    if (err) return errorResponse(res, err.message);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作历史');

    worksheet.columns = [
      { header: '记录ID', key: 'id', width: 36 },
      { header: '操作类型', key: 'operation_type', width: 20 },
      { header: '关联记录ID', key: 'record_id', width: 36 },
      { header: '修改字段', key: 'field_name', width: 20 },
      { header: '原值', key: 'old_value', width: 30 },
      { header: '新值', key: 'new_value', width: 30 },
      { header: '操作人', key: 'operator', width: 12 },
      { header: '操作时间', key: 'operation_time', width: 20 },
      { header: '备注', key: 'remarks', width: 30 }
    ];

    rows.forEach(row => worksheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=history_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router;
