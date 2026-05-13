const express = require('express');
const router = express.Router();
const db = require('../database');
const ExcelJS = require('exceljs');
router.post('/report', (req, res) => {
  const { start_date, end_date, operator, business_type } = req.body;
  let sql = `
    SELECT
      h.id,
      h.business_type,
      h.business_id,
      h.before_status,
      h.after_status,
      h.before_value,
      h.after_value,
      h.operator,
      h.remark,
      h.created_at
    FROM status_history h
    WHERE 1=1
  `;
  let params = [];
  if (start_date) {
    sql += ' AND DATE(h.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND DATE(h.created_at) <= ?';
    params.push(end_date);
  }
  if (operator) {
    sql += ' AND h.operator = ?';
    params.push(operator);
  }
  if (business_type) {
    sql += ' AND h.business_type = ?';
    params.push(business_type);
  }
  sql += ' ORDER BY h.created_at DESC';
  db.all(sql, params, async (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询数据失败' });
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作记录');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: '业务类型', key: 'business_type', width: 15 },
      { header: '业务ID', key: 'business_id', width: 36 },
      { header: '变更前状态', key: 'before_status', width: 20 },
      { header: '变更后状态', key: 'after_status', width: 20 },
      { header: '变更前值', key: 'before_value', width: 50 },
      { header: '变更后值', key: 'after_value', width: 50 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '操作时间', key: 'created_at', width: 20 }
    ];
    worksheet.addRows(rows);
    worksheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=gift_refund_report.xlsx');
    res.send(buffer);
  });
});
router.get('/operators', (req, res) => {
  db.all('SELECT DISTINCT operator FROM status_history WHERE operator IS NOT NULL ORDER BY operator', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询操作人失败' });
    }
    res.json({ success: true, data: rows.map(r => r.operator) });
  });
});
module.exports = router;
