const express = require('express');
const router = express.Router();
const db = require('../database');
const ValidationService = require('../services/validationService');

function generateIsolationId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ISO${dateStr}${random}`;
}

router.post('/single', async (req, res) => {
  try {
    const record = req.body;
    
    const validation = await ValidationService.validateIsolationRecord(record);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    if (!record.isolation_id) {
      record.isolation_id = generateIsolationId();
    }

    const stmt = db.prepare(`
      INSERT INTO isolation_records (
        isolation_id, child_id, check_id, start_date, start_time,
        end_date, end_time, isolation_reason, isolation_type, isolation_location,
        symptoms, diagnosis, hospital_name, doctor_name, body_temperature,
        has_close_contact, close_contact_details, guardian_notified, notification_method,
        notification_time, guardian_signature, is_ended, end_reason, checker_name, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.isolation_id, record.child_id, record.check_id || null, record.start_date, record.start_time,
      record.end_date || null, record.end_time || null, record.isolation_reason, record.isolation_type, record.isolation_location || null,
      record.symptoms || null, record.diagnosis || null, record.hospital_name || null, record.doctor_name || null, record.body_temperature || null,
      record.has_close_contact || 0, record.close_contact_details || null, record.guardian_notified || 0, record.notification_method || null,
      record.notification_time || null, record.guardian_signature || null, record.is_ended || 0, record.end_reason || null, record.checker_name, record.remarks || null
    );

    stmt.finalize();

    const siblingAlert = await ValidationService.checkSiblingContactAlert(
      record.child_id,
      record.start_date
    );

    res.json({
      success: true,
      message: '隔离记录创建成功',
      data: { isolation_id: record.isolation_id },
      siblingAlert,
      warnings: validation.warnings
    });
  } catch (error) {
    console.error('创建隔离记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '批量记录不能为空'
      });
    }

    const results = [];
    const errors = [];
    const siblingAlerts = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      const validation = await ValidationService.validateIsolationRecord(record);
      if (!validation.isValid) {
        errors.push({ index: i, errors: validation.errors, record });
        continue;
      }

      if (!record.isolation_id) {
        record.isolation_id = generateIsolationId();
      }

      try {
        const stmt = db.prepare(`
          INSERT INTO isolation_records (
            isolation_id, child_id, check_id, start_date, start_time,
            end_date, end_time, isolation_reason, isolation_type, isolation_location,
            symptoms, diagnosis, hospital_name, doctor_name, body_temperature,
            has_close_contact, close_contact_details, guardian_notified, notification_method,
            notification_time, guardian_signature, is_ended, end_reason, checker_name, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          record.isolation_id, record.child_id, record.check_id || null, record.start_date, record.start_time,
          record.end_date || null, record.end_time || null, record.isolation_reason, record.isolation_type, record.isolation_location || null,
          record.symptoms || null, record.diagnosis || null, record.hospital_name || null, record.doctor_name || null, record.body_temperature || null,
          record.has_close_contact || 0, record.close_contact_details || null, record.guardian_notified || 0, record.notification_method || null,
          record.notification_time || null, record.guardian_signature || null, record.is_ended || 0, record.end_reason || null, record.checker_name, record.remarks || null
        );

        stmt.finalize();

        const siblingAlert = await ValidationService.checkSiblingContactAlert(
          record.child_id,
          record.start_date
        );
        if (siblingAlert.hasAlert) {
          siblingAlerts.push({ isolation_id: record.isolation_id, child_id: record.child_id, ...siblingAlert });
        }

        results.push({ index: i, isolation_id: record.isolation_id, success: true, warnings: validation.warnings });
      } catch (dbError) {
        errors.push({ index: i, error: dbError.message, record });
      }
    }

    res.json({
      success: errors.length === 0,
      message: `批量导入完成: 成功${results.length}条, 失败${errors.length}条`,
      data: {
        total: records.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors
      },
      siblingAlerts,
      nextSteps: siblingAlerts.map(a => 
        `处理兄妹接触提醒: 儿童${a.child_id}隔离, 需排查兄妹${a.siblings.map(s => s.sibling_name).join(', ')}的健康状况`
      )
    });
  } catch (error) {
    console.error('批量导入隔离记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.put('/:isolationId/end', (req, res) => {
  const { isolationId } = req.params;
  const { end_date, end_time, end_reason, checker_name } = req.body;

  if (!end_date || !end_reason || !checker_name) {
    return res.status(400).json({
      success: false,
      message: '结束日期、结束原因和操作人不能为空'
    });
  }

  db.run(`
    UPDATE isolation_records 
    SET is_ended = 1, end_date = ?, end_time = ?, end_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE isolation_id = ?
  `, [end_date, end_time || null, end_reason, isolationId], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: '更新失败', error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, message: '隔离已结束' });
  });
});

router.get('/active', (req, res) => {
  db.all(`
    SELECT ir.*, c.name as child_name, c.class_name, c.guardian_name, c.guardian_phone
    FROM isolation_records ir
    JOIN children c ON ir.child_id = c.child_id
    WHERE ir.is_ended = 0
    ORDER BY ir.start_date DESC, ir.start_time DESC
  `, (err, records) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败', error: err.message });
    }
    res.json({ success: true, data: records, count: records.length });
  });
});

router.get('/:isolationId', (req, res) => {
  const { isolationId } = req.params;
  
  db.get(`
    SELECT ir.*, c.name as child_name, c.class_name, c.guardian_name, c.guardian_phone
    FROM isolation_records ir
    JOIN children c ON ir.child_id = c.child_id
    WHERE ir.isolation_id = ?
  `, [isolationId], (err, record) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败', error: err.message });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, data: record });
  });
});

module.exports = router;
