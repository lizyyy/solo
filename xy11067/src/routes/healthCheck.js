const express = require('express');
const router = express.Router();
const db = require('../database');
const ValidationService = require('../services/validationService');

function generateCheckId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `HC${dateStr}${random}`;
}

router.post('/single', async (req, res) => {
  try {
    const record = req.body;
    
    const validation = await ValidationService.validateHealthCheckRecord(record);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const siblingAlert = await ValidationService.checkSiblingContactAlert(
      record.child_id,
      record.check_date
    );

    if (!record.check_id) {
      record.check_id = generateCheckId();
    }

    const stmt = db.prepare(`
      INSERT INTO health_check_records (
        check_id, child_id, check_date, check_time, checker_name,
        body_temperature, has_fever, cough, runny_nose, sore_throat,
        diarrhea, vomiting, rash, conjunctivitis, hand_foot_mouth,
        other_symptoms, spirit_status, appetite_status, sleep_status,
        medication_name, medication_dosage, medication_time,
        is_allowed_entry, check_result, remarks, guardian_notified, notification_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.check_id, record.child_id, record.check_date, record.check_time, record.checker_name,
      record.body_temperature, record.has_fever || 0, record.cough || 0, record.runny_nose || 0, record.sore_throat || 0,
      record.diarrhea || 0, record.vomiting || 0, record.rash || 0, record.conjunctivitis || 0, record.hand_foot_mouth || 0,
      record.other_symptoms || null, record.spirit_status || null, record.appetite_status || null, record.sleep_status || null,
      record.medication_name || null, record.medication_dosage || null, record.medication_time || null,
      record.is_allowed_entry, record.check_result, record.remarks || null, record.guardian_notified || 0, record.notification_time || null
    );

    stmt.finalize();

    const consistency = await ValidationService.checkReportConsistency(record.check_id);

    res.json({
      success: true,
      message: '晨检记录创建成功',
      data: { check_id: record.check_id },
      siblingAlert,
      consistency,
      warnings: validation.warnings
    });
  } catch (error) {
    console.error('创建晨检记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { records, operator_name } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '批量记录不能为空'
      });
    }

    const results = [];
    const errors = [];
    const siblingAlerts = [];
    const consistencyIssues = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      const validation = await ValidationService.validateHealthCheckRecord(record);
      if (!validation.isValid) {
        errors.push({ index: i, errors: validation.errors, record });
        continue;
      }

      if (!record.check_id) {
        record.check_id = generateCheckId();
      }

      try {
        const stmt = db.prepare(`
          INSERT INTO health_check_records (
            check_id, child_id, check_date, check_time, checker_name,
            body_temperature, has_fever, cough, runny_nose, sore_throat,
            diarrhea, vomiting, rash, conjunctivitis, hand_foot_mouth,
            other_symptoms, spirit_status, appetite_status, sleep_status,
            medication_name, medication_dosage, medication_time,
            is_allowed_entry, check_result, remarks, guardian_notified, notification_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          record.check_id, record.child_id, record.check_date, record.check_time, record.checker_name,
          record.body_temperature, record.has_fever || 0, record.cough || 0, record.runny_nose || 0, record.sore_throat || 0,
          record.diarrhea || 0, record.vomiting || 0, record.rash || 0, record.conjunctivitis || 0, record.hand_foot_mouth || 0,
          record.other_symptoms || null, record.spirit_status || null, record.appetite_status || null, record.sleep_status || null,
          record.medication_name || null, record.medication_dosage || null, record.medication_time || null,
          record.is_allowed_entry, record.check_result, record.remarks || null, record.guardian_notified || 0, record.notification_time || null
        );

        stmt.finalize();

        const siblingAlert = await ValidationService.checkSiblingContactAlert(
          record.child_id,
          record.check_date
        );
        if (siblingAlert.hasAlert) {
          siblingAlerts.push({ check_id: record.check_id, child_id: record.child_id, ...siblingAlert });
        }

        const consistency = await ValidationService.checkReportConsistency(record.check_id);
        if (!consistency.isConsistent) {
          consistencyIssues.push({ check_id: record.check_id, child_id: record.child_id, ...consistency });
        }

        results.push({ index: i, check_id: record.check_id, success: true, warnings: validation.warnings });
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
      consistencyIssues,
      nextSteps: [
        ...siblingAlerts.map(a => `处理兄妹接触提醒: ${a.child_id} - ${a.siblings.map(s => s.sibling_name).join(', ')}`),
        ...consistencyIssues.map(c => `修正报表一致性: ${c.check_id} - 缺少${c.missingMaterials.length}项材料`)
      ]
    });
  } catch (error) {
    console.error('批量导入晨检记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

router.get('/:checkId', (req, res) => {
  const { checkId } = req.params;
  
  db.get('SELECT * FROM health_check_records WHERE check_id = ?', [checkId], (err, record) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败', error: err.message });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, data: record });
  });
});

router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  
  db.all(`
    SELECT hcr.*, c.name as child_name, c.class_name
    FROM health_check_records hcr
    JOIN children c ON hcr.child_id = c.child_id
    WHERE hcr.check_date = ?
    ORDER BY hcr.check_time
  `, [date], (err, records) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败', error: err.message });
    }
    res.json({ success: true, data: records, count: records.length });
  });
});

module.exports = router;
