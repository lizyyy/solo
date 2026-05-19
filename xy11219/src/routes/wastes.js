const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { requirePermission, PERMISSIONS, maskSensitiveFields } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const moment = require('moment');

router.post('/', requirePermission(PERMISSIONS.WASTE_CREATE), async (req, res) => {
  try {
    const { itemName, itemType, quantity, wasteReason, wasteTime } = req.body;

    if (!itemName || !itemType || !quantity || !wasteReason || !wasteTime) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const wasteMoment = moment(wasteTime);
    if (!wasteMoment.isValid()) {
      return res.status(400).json({ success: false, message: '时间格式无效' });
    }

    db.run(`
      INSERT INTO waste_records (
        item_name, item_type, quantity, waste_reason, waste_time, operator_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [itemName, itemType, quantity, wasteReason, wasteMoment.format(), req.user.id], async function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '创建废弃记录失败', error: err.message });
      }

      await logAction(
        req.user.id,
        'CREATE_WASTE',
        'waste_records',
        this.lastID,
        null,
        req.body,
        req.ip,
        req.get('User-Agent')
      );

      res.status(201).json({
        success: true,
        message: '废弃记录创建成功',
        data: { id: this.lastID }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/', requirePermission(PERMISSIONS.WASTE_READ), async (req, res) => {
  try {
    const { status, itemType, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        w.*,
        u1.real_name as operator_name,
        u2.real_name as reviewer_name
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

    query += ' ORDER BY w.waste_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      const maskedData = maskSensitiveFields(rows, req.user.role);

      db.get('SELECT COUNT(*) as total FROM waste_records', (countErr, countRow) => {
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

router.put('/:id/review', requirePermission(PERMISSIONS.WASTE_REVIEW), async (req, res) => {
  try {
    const { status } = req.body;
    const recordId = req.params.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态无效' });
    }

    db.get('SELECT * FROM waste_records WHERE id = ?', [recordId], async (err, oldRecord) => {
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
        UPDATE waste_records 
        SET status = ?, reviewer_id = ?, review_time = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, req.user.id, moment().format(), recordId], async function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ success: false, message: '复核失败', error: updateErr.message });
        }

        await logAction(
          req.user.id,
          'REVIEW_WASTE',
          'waste_records',
          recordId,
          oldRecord,
          { ...oldRecord, status },
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
