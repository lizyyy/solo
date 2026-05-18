const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const db = getDb();
const { AppError, errorCodes, asyncHandler } = require('../middleware/errorHandler');
const {
  checkConsecutiveWarningConflict,
  checkWarningConsistency,
  checkDuplicateWarningNo,
  checkSilentOverwrite,
  validateSeverityLevel,
  validateStatus,
  recordHistory
} = require('../utils/validation');

router.get('/', asyncHandler(async (req, res) => {
  const { greenhouse_id, status, disease_type } = req.query;
  
  let query = 'SELECT * FROM disease_warnings WHERE 1=1';
  let params = [];
  
  if (greenhouse_id) {
    query += ' AND greenhouse_id = ?';
    params.push(greenhouse_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (disease_type) {
    query += ' AND disease_type = ?';
    params.push(disease_type);
  }
  
  query += ' ORDER BY detected_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) throw err;
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  db.get('SELECT * FROM disease_warnings WHERE id = ?', [req.params.id], (err, row) => {
    if (err) throw err;
    if (!row) {
      throw new AppError('预警记录不存在', 404, errorCodes.WARNING_NOT_FOUND);
    }
    res.json({
      success: true,
      data: row
    });
  });
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  db.all(`
    SELECT * FROM warning_history 
    WHERE warning_id = ? 
    ORDER BY changed_at DESC
  `, [req.params.id], (err, rows) => {
    if (err) throw err;
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const {
    greenhouse_id, warning_no, disease_type, severity_level,
    affected_area, detected_date, reporter, description,
    temperature, humidity, ph_value, fertilizer_used, pesticide_applied
  } = req.body;

  if (!greenhouse_id || !warning_no || !disease_type || !severity_level || 
      !affected_area || !detected_date || !reporter) {
    throw new AppError('缺少必填字段', 400, 'MISSING_REQUIRED_FIELDS');
  }

  validateSeverityLevel(severity_level);
  
  await checkDuplicateWarningNo(warning_no);
  await checkConsecutiveWarningConflict(greenhouse_id, disease_type, severity_level, detected_date);

  const id = `WARN-${Date.now()}`;
  
  db.run(`
    INSERT INTO disease_warnings 
    (id, greenhouse_id, warning_no, disease_type, severity_level, affected_area,
     detected_date, reporter, status, description, temperature, humidity,
     ph_value, fertilizer_used, pesticide_applied, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, 1)
  `, [
    id, greenhouse_id, warning_no, disease_type, severity_level, affected_area,
    detected_date, reporter, description, temperature, humidity,
    ph_value, fertilizer_used, pesticide_applied
  ], function(err) {
    if (err) throw err;
    
    db.get('SELECT * FROM disease_warnings WHERE id = ?', [id], (err, row) => {
      if (err) throw err;
      res.status(201).json({
        success: true,
        data: row,
        message: '预警创建成功'
      });
    });
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const warningId = req.params.id;
  const {
    severity_level, status, description, temperature, humidity,
    ph_value, fertilizer_used, pesticide_applied, version, operator
  } = req.body;

  if (!version) {
    throw new AppError('必须提供当前版本号以防止静默覆盖', 400, 'VERSION_REQUIRED');
  }

  if (!operator) {
    throw new AppError('必须提供操作人信息', 400, 'OPERATOR_REQUIRED');
  }

  const currentRecord = await checkSilentOverwrite(warningId, version);
  
  if (severity_level) {
    validateSeverityLevel(severity_level);
  }
  if (status) {
    validateStatus(status);
  }

  const updates = [];
  const params = [];
  const historyPromises = [];

  const fieldMap = {
    severity_level, status, description, temperature, humidity,
    ph_value, fertilizer_used, pesticide_applied
  };

  Object.entries(fieldMap).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
      if (currentRecord[key] !== value) {
        historyPromises.push(recordHistory(warningId, key, currentRecord[key], value, operator));
      }
    }
  });

  if (updates.length === 0) {
    throw new AppError('没有提供需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
  }

  updates.push('version = version + 1');
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(warningId);

  db.run(`
    UPDATE disease_warnings 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params, async function(err) {
    if (err) throw err;
    
    await Promise.all(historyPromises);
    
    db.get('SELECT * FROM disease_warnings WHERE id = ?', [warningId], (err, row) => {
      if (err) throw err;
      res.json({
        success: true,
        data: row,
        message: '预警更新成功'
      });
    });
  });
}));

router.post('/:id/withdraw', asyncHandler(async (req, res) => {
  const warningId = req.params.id;
  const { operator, reason, version } = req.body;

  if (!operator || !version) {
    throw new AppError('必须提供操作人和当前版本号', 400, 'MISSING_REQUIRED_FIELDS');
  }

  await checkSilentOverwrite(warningId, version);

  db.run(`
    UPDATE disease_warnings 
    SET status = 'withdrawn', version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [warningId], async function(err) {
    if (err) throw err;
    
    await recordHistory(warningId, 'status', 'current', 'withdrawn', operator);
    await recordHistory(warningId, 'withdraw_reason', '', reason, operator);
    
    db.get('SELECT * FROM disease_warnings WHERE id = ?', [warningId], (err, row) => {
      if (err) throw err;
      res.json({
        success: true,
        data: row,
        message: '预警撤回成功'
      });
    });
  });
}));

router.post('/:id/reapply', asyncHandler(async (req, res) => {
  const warningId = req.params.id;
  const {
    new_severity_level, new_affected_area, new_description,
    operator, version
  } = req.body;

  if (!operator || !version || !new_severity_level || !new_affected_area) {
    throw new AppError('缺少必填字段', 400, 'MISSING_REQUIRED_FIELDS');
  }

  db.get('SELECT * FROM disease_warnings WHERE id = ?', [warningId], async (err, originalRow) => {
    if (err) throw err;
    if (!originalRow) {
      throw new AppError('原预警记录不存在', 404, errorCodes.WARNING_NOT_FOUND);
    }
    if (originalRow.status !== 'withdrawn') {
      throw new AppError(
        '只有已撤回的预警才能重新申请',
        400,
        errorCodes.WITHDRAWN_REAPPLY_PATH_ERROR,
        { currentStatus: originalRow.status }
      );
    }

    if (originalRow.version !== version) {
      throw new AppError(
        `版本不匹配：当前版本${originalRow.version}，提供版本${version}`,
        409,
        errorCodes.SILENT_OVERWRITE_ATTEMPT
      );
    }

    validateSeverityLevel(new_severity_level);
    
    const isUpgraded = require('../utils/validation').checkSeverityUpgrade(
      originalRow.severity_level, 
      new_severity_level
    );
    if (!isUpgraded) {
      throw new AppError(
        `重新申请的预警必须升级严重级别：原级别${originalRow.severity_level}，新级别${new_severity_level}`,
        409,
        errorCodes.CONSECUTIVE_WARNING_NOT_UPGRADED
      );
    }

    const newWarningId = `WARN-${Date.now()}`;
    const newWarningNo = originalRow.warning_no.replace(/-\d+$/, '') + `-${Date.now().toString().slice(-3)}`;

    db.serialize(() => {
      db.run(`
        INSERT INTO disease_warnings 
        (id, greenhouse_id, warning_no, disease_type, severity_level, affected_area,
         detected_date, reporter, status, description, temperature, humidity,
         ph_value, fertilizer_used, pesticide_applied, previous_warning_id, version)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'reapplied', ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        newWarningId, originalRow.greenhouse_id, newWarningNo, originalRow.disease_type,
        new_severity_level, new_affected_area, operator,
        new_description || originalRow.description,
        originalRow.temperature, originalRow.humidity,
        originalRow.ph_value, originalRow.fertilizer_used,
        originalRow.pesticide_applied, warningId
      ], function(err) {
        if (err) throw err;
        
        recordHistory(newWarningId, 'previous_warning_id', '', warningId, operator);
        
        db.get('SELECT * FROM disease_warnings WHERE id = ?', [newWarningId], (err, row) => {
          if (err) throw err;
          res.status(201).json({
            success: true,
            data: row,
            originalWarningId: warningId,
            message: '预警重新申请成功（新建独立记录，不覆盖原记录）'
          });
        });
      });
    });
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  throw new AppError('禁止直接删除预警记录，请使用撤回功能', 405, 'DELETE_NOT_ALLOWED');
}));

router.get('/consistency/:greenhouseId', asyncHandler(async (req, res) => {
  const warnings = await checkWarningConsistency(req.params.greenhouseId);
  res.json({
    success: true,
    greenhouseId: req.params.greenhouseId,
    isConsistent: true,
    totalWarnings: warnings.length,
    message: '预警清单一致性检查通过'
  });
}));

module.exports = router;