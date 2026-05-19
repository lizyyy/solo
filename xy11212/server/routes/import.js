const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const { runQuery, allQuery, getQuery } = require('../config/database');
const { logAudit } = require('../config/logger');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '../../uploads') });

const inspectionRowSchema = Joi.object({
  inspection_date: Joi.string().required(),
  inspector_name: Joi.string().required(),
  pump_room_no: Joi.string().required(),
  water_pressure: Joi.number().optional(),
  water_level: Joi.number().optional(),
  pump_status: Joi.string().valid('正常', '故障', '维护中').optional(),
  power_status: Joi.string().valid('正常', '断电', '异常').optional(),
  temperature: Joi.number().optional(),
  humidity: Joi.number().optional(),
  remarks: Joi.string().optional()
});

const alarmSchema = Joi.object({
  alarm_time: Joi.string().required(),
  sensor_id: Joi.string().required(),
  sensor_type: Joi.string().required(),
  alarm_level: Joi.string().valid('低', '中', '高', '紧急').required(),
  alarm_type: Joi.string().required(),
  alarm_value: Joi.number().optional(),
  threshold_value: Joi.number().optional(),
  pump_room_no: Joi.string().required(),
  remarks: Joi.string().optional()
});

const getFixSuggestion = (errorMessage, row) => {
  if (errorMessage.includes('inspection_date')) {
    return '请检查日期格式，建议使用 YYYY-MM-DD 格式';
  }
  if (errorMessage.includes('pump_status')) {
    return '水泵状态只能是：正常、故障、维护中';
  }
  if (errorMessage.includes('power_status')) {
    return '电源状态只能是：正常、断电、异常';
  }
  if (errorMessage.includes('alarm_level')) {
    return '告警级别只能是：低、中、高、紧急';
  }
  if (errorMessage.includes('number')) {
    return '该字段必须是有效的数字';
  }
  return '请检查必填字段是否完整，数据格式是否正确';
};

router.post('/inspection-csv', requirePermission('import:inspection'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const results = [];
    const badRecords = [];
    let rowNumber = 0;

    const stream = fs.createReadStream(req.file.path)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
      }));

    for await (const row of stream) {
      rowNumber++;
      const { error, value } = inspectionRowSchema.validate(row, { abortEarly: false });
      
      if (error) {
        badRecords.push({
          source_type: 'inspection_csv',
          file_name: req.file.originalname,
          row_number: rowNumber,
          raw_data: JSON.stringify(row),
          error_reason: error.details.map(d => d.message).join('; '),
          fix_suggestion: getFixSuggestion(error.details[0].message, row)
        });
      } else {
        results.push(value);
      }
    }

    let successCount = 0;
    for (const record of results) {
      try {
        await runQuery(
          `INSERT INTO inspections (inspection_date, inspector_name, pump_room_no, water_pressure, water_level, pump_status, power_status, temperature, humidity, remarks, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [record.inspection_date, record.inspector_name, record.pump_room_no, record.water_pressure, record.water_level, 
           record.pump_status, record.power_status, record.temperature, record.humidity, record.remarks, req.user.id]
        );
        successCount++;
      } catch (dbError) {
        badRecords.push({
          source_type: 'inspection_csv',
          file_name: req.file.originalname,
          row_number: rowNumber - results.length + results.indexOf(record) + 1,
          raw_data: JSON.stringify(record),
          error_reason: dbError.message,
          fix_suggestion: '数据库写入失败，请检查数据是否重复或联系管理员'
        });
      }
    }

    for (const badRecord of badRecords) {
      await runQuery(
        `INSERT INTO bad_records (source_type, file_name, row_number, raw_data, error_reason, fix_suggestion) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [badRecord.source_type, badRecord.file_name, badRecord.row_number, badRecord.raw_data, badRecord.error_reason, badRecord.fix_suggestion]
      );
    }

    fs.unlinkSync(req.file.path);

    await logAudit(req.user.id, req.user.name, '导入巡检CSV', 'import', null, {
      file: req.file.originalname,
      successCount,
      badCount: badRecords.length
    });

    res.json({
      success: true,
      successCount,
      badCount: badRecords.length,
      message: `成功导入 ${successCount} 条记录，${badRecords.length} 条记录需要修正`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/alarm-json', requirePermission('import:alarm'), async (req, res) => {
  try {
    const alarms = req.body;
    if (!Array.isArray(alarms)) {
      return res.status(400).json({ error: '请提供JSON数组格式的告警数据' });
    }

    const badRecords = [];
    let successCount = 0;

    for (let i = 0; i < alarms.length; i++) {
      const { error, value } = alarmSchema.validate(alarms[i], { abortEarly: false });
      
      if (error) {
        badRecords.push({
          source_type: 'alarm_json',
          file_name: 'API导入',
          row_number: i + 1,
          raw_data: JSON.stringify(alarms[i]),
          error_reason: error.details.map(d => d.message).join('; '),
          fix_suggestion: getFixSuggestion(error.details[0].message, alarms[i])
        });
      } else {
        try {
          await runQuery(
            `INSERT INTO alarms (alarm_time, sensor_id, sensor_type, alarm_level, alarm_type, alarm_value, threshold_value, pump_room_no, remarks, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [value.alarm_time, value.sensor_id, value.sensor_type, value.alarm_level, value.alarm_type, 
             value.alarm_value, value.threshold_value, value.pump_room_no, value.remarks, req.user.id]
          );
          successCount++;
        } catch (dbError) {
          badRecords.push({
            source_type: 'alarm_json',
            file_name: 'API导入',
            row_number: i + 1,
            raw_data: JSON.stringify(alarms[i]),
            error_reason: dbError.message,
            fix_suggestion: '数据库写入失败'
          });
        }
      }
    }

    for (const badRecord of badRecords) {
      await runQuery(
        `INSERT INTO bad_records (source_type, file_name, row_number, raw_data, error_reason, fix_suggestion) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [badRecord.source_type, badRecord.file_name, badRecord.row_number, badRecord.raw_data, badRecord.error_reason, badRecord.fix_suggestion]
      );
    }

    await logAudit(req.user.id, req.user.name, '导入告警JSON', 'import', null, {
      successCount,
      badCount: badRecords.length
    });

    res.json({
      success: true,
      successCount,
      badCount: badRecords.length,
      message: `成功导入 ${successCount} 条告警，${badRecords.length} 条记录需要修正`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bad-records', requirePermission('badRecords:read'), async (req, res) => {
  try {
    const { source_type, status } = req.query;
    let sql = 'SELECT * FROM bad_records WHERE 1=1';
    const params = [];

    if (source_type) {
      sql += ' AND source_type = ?';
      params.push(source_type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const records = await allQuery(sql, params);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/bad-records/:id/handle', requirePermission('badRecords:handle'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['已修正', '已忽略'].includes(status)) {
      return res.status(400).json({ error: '状态必须是已修正或已忽略' });
    }

    const record = await getQuery('SELECT * FROM bad_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    await runQuery(
      'UPDATE bad_records SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '处理坏记录', 'bad_records', req.params.id, { status });

    const updated = await getQuery('SELECT * FROM bad_records WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
