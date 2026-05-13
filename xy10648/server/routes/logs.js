const express = require('express');
const router = express.Router();
const db = require('../database');
const ExcelJS = require('exceljs');

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

router.get('/', async (req, res) => {
  try {
    const { target_type, operator, limit } = req.query;
    let sql = 'SELECT * FROM operation_logs';
    let params = [];

    if (target_type || operator) {
      sql += ' WHERE 1=1';
      if (target_type) {
        sql += ' AND target_type = ?';
        params.push(target_type);
      }
      if (operator) {
        sql += ' AND operator = ?';
        params.push(operator);
      }
    }

    sql += ' ORDER BY created_at DESC';
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const logs = await allAsync(sql, params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { responsible_person, start_date, end_date } = req.query;
    
    let sql = `
      SELECT 
        l.id,
        l.operation_type,
        l.target_type,
        l.target_id,
        l.operator as responsible_person,
        l.details,
        l.created_at as processed_time,
        a.activity_name,
        b.club_name
      FROM operation_logs l
      LEFT JOIN activity_applications a ON l.target_type = 'activity' AND l.target_id = a.id
      LEFT JOIN club_budgets b ON l.target_type = 'budget' AND l.target_id = b.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (responsible_person) {
      sql += ' AND l.operator = ?';
      params.push(responsible_person);
    }
    
    if (start_date) {
      sql += ' AND l.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND l.created_at <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY l.created_at DESC';

    const logs = await allAsync(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('报销操作记录');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '操作类型', key: 'operation_type', width: 15 },
      { header: '目标类型', key: 'target_type', width: 15 },
      { header: '目标ID', key: 'target_id', width: 36 },
      { header: '责任人', key: 'responsible_person', width: 15 },
      { header: '详情', key: 'details', width: 50 },
      { header: '处理时间', key: 'processed_time', width: 25 },
      { header: '关联活动', key: 'activity_name', width: 20 },
      { header: '关联社团', key: 'club_name', width: 20 }
    ];

    worksheet.addRows(logs);

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=expense_records.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
