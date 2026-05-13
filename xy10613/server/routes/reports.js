const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../utils/db');

router.get('/export', async (req, res) => {
  try {
    const { operator, startTime, endTime, type } = req.query;
    let sql = `
      SELECT 
        pr.id,
        a.title,
        pr.publish_type,
        pr.operator,
        pr.before_value,
        pr.after_value,
        pr.status,
        pr.error_message,
        pr.created_at
      FROM publish_records pr
      LEFT JOIN articles a ON pr.article_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (operator) {
      sql += ` AND pr.operator = ?`;
      params.push(operator);
    }
    if (startTime) {
      sql += ` AND pr.created_at >= ?`;
      params.push(startTime);
    }
    if (endTime) {
      sql += ` AND pr.created_at <= ?`;
      params.push(endTime);
    }
    if (type) {
      sql += ` AND pr.publish_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY pr.created_at DESC`;
    const records = await db.query(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('发布记录报表');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '文章标题', key: 'title', width: 40 },
      { header: '发布类型', key: 'publish_type', width: 15 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '变更前', key: 'before_value', width: 30 },
      { header: '变更后', key: 'after_value', width: 30 },
      { header: '状态', key: 'status', width: 10 },
      { header: '错误信息', key: 'error_message', width: 40 },
      { header: '操作时间', key: 'created_at', width: 25 }
    ];

    worksheet.addRows(records);

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=发布记录报表.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/publishes', async (req, res) => {
  try {
    const { operator, startTime, endTime, type, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT 
        pr.id,
        a.title,
        pr.publish_type,
        pr.operator,
        pr.before_value,
        pr.after_value,
        pr.status,
        pr.error_message,
        pr.created_at
      FROM publish_records pr
      LEFT JOIN articles a ON pr.article_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (operator) {
      sql += ` AND pr.operator = ?`;
      params.push(operator);
    }
    if (startTime) {
      sql += ` AND pr.created_at >= ?`;
      params.push(startTime);
    }
    if (endTime) {
      sql += ` AND pr.created_at <= ?`;
      params.push(endTime);
    }
    if (type) {
      sql += ` AND pr.publish_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const records = await db.query(sql, params);

    let countSql = `
      SELECT COUNT(*) as total
      FROM publish_records pr
      LEFT JOIN articles a ON pr.article_id = a.id
      WHERE 1=1
    `;
    const countParams = params.slice(0, -2);
    const countResult = await db.get(countSql, countParams);

    res.json({
      success: true,
      data: records,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/operators', async (req, res) => {
  try {
    const operators = await db.query(`SELECT DISTINCT operator FROM publish_records WHERE operator IS NOT NULL`);
    res.json({ success: true, data: operators.map(o => o.operator) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
