const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ExcelJS = require('exceljs');

router.get('/export', async (req, res) => {
  const { responsible_person, start_date, end_date, type } = req.query;

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '景区讲解器管理系统';

    const addAuditSheet = () => {
      const worksheet = workbook.addWorksheet('审计日志');
      worksheet.columns = [
        { header: '表名', key: 'table_name', width: 20 },
        { header: '字段名', key: 'field_name', width: 20 },
        { header: '原值', key: 'old_value', width: 20 },
        { header: '新值', key: 'new_value', width: 20 },
        { header: '操作人', key: 'operator', width: 15 },
        { header: '时间', key: 'created_at', width: 20 },
      ];

      return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (responsible_person) {
          query += ' AND operator LIKE ?';
          params.push(`%${responsible_person}%`);
        }
        if (start_date) {
          query += ' AND created_at >= ?';
          params.push(start_date);
        }
        if (end_date) {
          query += ' AND created_at <= ?';
          params.push(end_date);
        }

        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => worksheet.addRow(row));
            resolve();
          }
        });
      });
    };

    const addFlowSheet = () => {
      const worksheet = workbook.addWorksheet('流转记录');
      worksheet.columns = [
        { header: '设备编号', key: 'device_number', width: 15 },
        { header: '流转类型', key: 'flow_type', width: 15 },
        { header: '操作人', key: 'operator', width: 15 },
        { header: '备注', key: 'remark', width: 30 },
        { header: '时间', key: 'created_at', width: 20 },
      ];

      return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM flow_records WHERE 1=1';
        const params = [];

        if (responsible_person) {
          query += ' AND operator LIKE ?';
          params.push(`%${responsible_person}%`);
        }
        if (start_date) {
          query += ' AND created_at >= ?';
          params.push(start_date);
        }
        if (end_date) {
          query += ' AND created_at <= ?';
          params.push(end_date);
        }

        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => worksheet.addRow(row));
            resolve();
          }
        });
      });
    };

    const addExceptionSheet = () => {
      const worksheet = workbook.addWorksheet('异常记录');
      worksheet.columns = [
        { header: '设备编号', key: 'device_number', width: 15 },
        { header: '异常类型', key: 'exception_type', width: 20 },
        { header: '描述', key: 'description', width: 30 },
        { header: '状态', key: 'status', width: 10 },
        { header: '责任人', key: 'responsible_person', width: 15 },
        { header: '操作人', key: 'operator', width: 15 },
        { header: '时间', key: 'created_at', width: 20 },
      ];

      return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM exceptions WHERE 1=1';
        const params = [];

        if (responsible_person) {
          query += ' AND (responsible_person LIKE ? OR operator LIKE ?)';
          params.push(`%${responsible_person}%`, `%${responsible_person}%`);
        }
        if (start_date) {
          query += ' AND created_at >= ?';
          params.push(start_date);
        }
        if (end_date) {
          query += ' AND created_at <= ?';
          params.push(end_date);
        }

        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => worksheet.addRow(row));
            resolve();
          }
        });
      });
    };

    await Promise.all([addAuditSheet(), addFlowSheet(), addExceptionSheet()]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit', (req, res) => {
  const { table_name, record_id, operator, start_date, end_date } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (table_name) {
    query += ' AND table_name = ?';
    params.push(table_name);
  }
  if (record_id) {
    query += ' AND record_id = ?';
    params.push(record_id);
  }
  if (operator) {
    query += ' AND operator LIKE ?';
    params.push(`%${operator}%`);
  }
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

module.exports = router;
