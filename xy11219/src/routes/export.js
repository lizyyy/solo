const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { db } = require('../database/init');
const { requirePermission, PERMISSIONS, maskSensitiveFields } = require('../middleware/auth');
const moment = require('moment');

router.get('/samples', requirePermission(PERMISSIONS.EXPORT), async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        s.id,
        s.dish_name as '菜品名称',
        s.dish_code as '菜品编码',
        s.sample_time as '留样时间',
        s.sample_quantity as '留样数量',
        s.refrigerator_id as '冰箱编号',
        s.storage_location as '存放位置',
        s.expiry_time as '过期时间',
        s.status as '状态',
        u1.real_name as '操作人',
        u2.real_name as '复核人',
        s.review_time as '复核时间',
        s.review_comment as '复核备注',
        s.created_at as '创建时间'
      FROM sample_records s
      LEFT JOIN users u1 ON s.operator_id = u1.id
      LEFT JOIN users u2 ON s.reviewer_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (startDate) {
      query += ' AND s.sample_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND s.sample_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY s.sample_time DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '导出失败', error: err.message });
      }

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(rows);

      const filename = `samples_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/temperatures', requirePermission(PERMISSIONS.EXPORT), async (req, res) => {
  try {
    const { status, refrigeratorId, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.refrigerator_id as '冰箱编号',
        t.refrigerator_name as '冰箱名称',
        t.temperature as '温度(℃)',
        t.measure_time as '测量时间',
        u.real_name as '操作人',
        t.status as '状态',
        t.comment as '备注',
        t.created_at as '创建时间'
      FROM temperature_records t
      LEFT JOIN users u ON t.operator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (refrigeratorId) {
      query += ' AND t.refrigerator_id = ?';
      params.push(refrigeratorId);
    }

    if (startDate) {
      query += ' AND t.measure_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND t.measure_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY t.measure_time DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '导出失败', error: err.message });
      }

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(rows);

      const filename = `temperatures_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/wastes', requirePermission(PERMISSIONS.EXPORT), async (req, res) => {
  try {
    const { status, itemType, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        w.id,
        w.item_name as '物品名称',
        w.item_type as '物品类型',
        w.quantity as '数量',
        w.waste_reason as '废弃原因',
        w.waste_time as '废弃时间',
        u1.real_name as '操作人',
        u2.real_name as '复核人',
        w.status as '状态',
        w.review_time as '复核时间',
        w.created_at as '创建时间'
      FROM waste_records w
      LEFT JOIN users u1 ON w.operator_id = u1.id
      LEFT JOIN users u2 ON w.reviewer_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND w.status = ?';
      params.push(status);
    }

    if (itemType) {
      query += ' AND w.item_type = ?';
      params.push(itemType);
    }

    if (startDate) {
      query += ' AND w.waste_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND w.waste_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY w.waste_time DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '导出失败', error: err.message });
      }

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(rows);

      const filename = `wastes_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

module.exports = router;
