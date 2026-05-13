const express = require('express');
const router = express.Router();
const { db } = require('../database');
const ExcelJS = require('exceljs');

router.get('/all', (req, res) => {
  const { operator, start_date, end_date } = req.query;
  
  db.all(`
    SELECT 
      l.id,
      l.operation_type,
      l.module,
      l.record_id,
      l.operator_id,
      l.operator_name,
      l.description,
      l.ip_address,
      l.created_at,
      l.old_value,
      l.new_value
    FROM operation_logs l
    WHERE 1=1
    ${operator ? 'AND l.operator_name LIKE ?' : ''}
    ${start_date ? 'AND l.created_at >= ?' : ''}
    ${end_date ? 'AND l.created_at <= ?' : ''}
    ORDER BY l.created_at DESC
  `, 
  [
    ...(operator ? [`%${operator}%`] : []),
    ...(start_date ? [start_date] : []),
    ...(end_date ? [end_date + 'T23:59:59'] : [])
  ],
  async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作日志');

    worksheet.columns = [
      { header: '日志ID', key: 'id', width: 36 },
      { header: '操作类型', key: 'operation_type', width: 12 },
      { header: '模块', key: 'module', width: 20 },
      { header: '记录ID', key: 'record_id', width: 36 },
      { header: '操作人ID', key: 'operator_id', width: 12 },
      { header: '操作人', key: 'operator_name', width: 15 },
      { header: '描述', key: 'description', width: 40 },
      { header: 'IP地址', key: 'ip_address', width: 15 },
      { header: '操作时间', key: 'created_at', width: 25 },
      { header: '旧值', key: 'old_value', width: 50 },
      { header: '新值', key: 'new_value', width: 50 }
    ];

    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=operation_logs.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/ledger', (req, res) => {
  const { operator, start_date, end_date } = req.query;
  
  db.all(`
    SELECT * FROM balance_ledger
    WHERE 1=1
    ${operator ? 'AND operator_name LIKE ?' : ''}
    ${start_date ? 'AND created_at >= ?' : ''}
    ${end_date ? 'AND created_at <= ?' : ''}
    ORDER BY created_at DESC
  `, 
  [
    ...(operator ? [`%${operator}%`] : []),
    ...(start_date ? [start_date] : []),
    ...(end_date ? [end_date + 'T23:59:59'] : [])
  ],
  async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('余额账本');

    worksheet.columns = [
      { header: '账本ID', key: 'id', width: 36 },
      { header: '交易ID', key: 'transaction_id', width: 20 },
      { header: '课包ID', key: 'package_id', width: 36 },
      { header: '会员ID', key: 'member_id', width: 12 },
      { header: '会员姓名', key: 'member_name', width: 15 },
      { header: '交易类型', key: 'transaction_type', width: 15 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '课时变化', key: 'classes_change', width: 12 },
      { header: '变更前余额', key: 'balance_before', width: 15 },
      { header: '变更后余额', key: 'balance_after', width: 15 },
      { header: '变更前课时', key: 'classes_before', width: 15 },
      { header: '变更后课时', key: 'classes_after', width: 15 },
      { header: '描述', key: 'description', width: 40 },
      { header: '操作人ID', key: 'operator_id', width: 12 },
      { header: '操作人', key: 'operator_name', width: 15 },
      { header: '关联记录ID', key: 'reference_id', width: 36 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];

    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=balance_ledger.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
});

module.exports = router;
