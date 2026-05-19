const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { requirePermission, PERMISSIONS, maskSensitiveFields } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const moment = require('moment');

router.post('/', requirePermission(PERMISSIONS.SAMPLE_CREATE), async (req, res) => {
  try {
    const { dishName, dishCode, sampleTime, sampleQuantity, refrigeratorId, storageLocation, expiryTime } = req.body;

    if (!dishName || !sampleTime || !sampleQuantity || !refrigeratorId || !storageLocation || !expiryTime) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const sampleMoment = moment(sampleTime);
    const expiryMoment = moment(expiryTime);

    if (!sampleMoment.isValid() || !expiryMoment.isValid()) {
      return res.status(400).json({ success: false, message: '时间格式无效' });
    }

    if (expiryMoment.isBefore(sampleMoment)) {
      return res.status(400).json({ success: false, message: '过期时间不能早于留样时间' });
    }

    if (expiryMoment.diff(sampleMoment, 'hours') > 48) {
      return res.status(400).json({ success: false, message: '留样时间不能超过48小时' });
    }

    db.run(`
      INSERT INTO sample_records (
        dish_name, dish_code, sample_time, sample_quantity, 
        refrigerator_id, operator_id, storage_location, expiry_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [dishName, dishCode, sampleMoment.format(), sampleQuantity, refrigeratorId, req.user.id, storageLocation, expiryMoment.format()], async function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '创建留样记录失败', error: err.message });
      }

      await logAction(
        req.user.id,
        'CREATE_SAMPLE',
        'sample_records',
        this.lastID,
        null,
        req.body,
        req.ip,
        req.get('User-Agent')
      );

      res.status(201).json({
        success: true,
        message: '留样记录创建成功',
        data: { id: this.lastID }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/', requirePermission(PERMISSIONS.SAMPLE_READ), async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        s.*,
        u1.real_name as operator_name,
        u2.real_name as reviewer_name
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

    query += ' ORDER BY s.sample_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      const maskedData = maskSensitiveFields(rows, req.user.role);

      db.get('SELECT COUNT(*) as total FROM sample_records', (countErr, countRow) => {
        res.json({
          success: true,
          data: maskedData,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countRow.total
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/:id', requirePermission(PERMISSIONS.SAMPLE_READ), async (req, res) => {
  try {
    db.get(`
      SELECT 
        s.*,
        u1.real_name as operator_name,
        u2.real_name as reviewer_name
      FROM sample_records s
      LEFT JOIN users u1 ON s.operator_id = u1.id
      LEFT JOIN users u2 ON s.reviewer_id = u2.id
      WHERE s.id = ?
    `, [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      if (!row) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const maskedData = maskSensitiveFields(row, req.user.role);
      res.json({ success: true, data: maskedData });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.put('/:id/review', requirePermission(PERMISSIONS.SAMPLE_REVIEW), async (req, res) => {
  try {
    const { status, reviewComment } = req.body;
    const recordId = req.params.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态无效' });
    }

    db.get('SELECT * FROM sample_records WHERE id = ?', [recordId], async (err, oldRecord) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      if (!oldRecord) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      if (oldRecord.status !== 'pending') {
        return res.status(400).json({ success: false, message: '该记录已复核，不能重复操作' });
      }

      db.run(`
        UPDATE sample_records 
        SET status = ?, reviewer_id = ?, review_time = ?, review_comment = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, req.user.id, moment().format(), reviewComment, recordId], async function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ success: false, message: '复核失败', error: updateErr.message });
        }

        await logAction(
          req.user.id,
          'REVIEW_SAMPLE',
          'sample_records',
          recordId,
          oldRecord,
          { ...oldRecord, status, review_comment: reviewComment },
          req.ip,
          req.get('User-Agent')
        );

        res.json({ success: true, message: '复核成功' });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

module.exports = router;
