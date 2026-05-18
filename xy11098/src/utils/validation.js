const { getDb } = require('../database/db');
const db = getDb();
const { AppError, errorCodes } = require('../middleware/errorHandler');

const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };

function checkSeverityUpgrade(oldSeverity, newSeverity) {
  return severityOrder[newSeverity] >= severityOrder[oldSeverity];
}

async function checkConsecutiveWarningConflict(greenhouseId, diseaseType, newSeverity, detectedDate) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT id, severity_level, detected_date, warning_no
      FROM disease_warnings
      WHERE greenhouse_id = ? 
        AND disease_type = ? 
        AND status NOT IN ('resolved', 'withdrawn')
        AND detected_date < ?
      ORDER BY detected_date DESC
      LIMIT 1
    `, [greenhouseId, diseaseType, detectedDate], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        const isUpgraded = checkSeverityUpgrade(row.severity_level, newSeverity);
        if (!isUpgraded) {
          reject(new AppError(
            `同一区域连续预警未升级：区域${greenhouseId}的${diseaseType}已有预警${row.warning_no}(${row.severity_level})，新预警${newSeverity}未升级`,
            409,
            errorCodes.CONSECUTIVE_WARNING_NOT_UPGRADED,
            {
              existingWarning: {
                id: row.id,
                warningNo: row.warning_no,
                severity: row.severity_level,
                detectedDate: row.detected_date
              },
              newWarning: {
                severity: newSeverity
              },
              suggestion: '请升级预警级别或确认是否为同一病害事件'
            }
          ));
        }
      }
      resolve(row);
    });
  });
}

async function checkWarningConsistency(greenhouseId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT id, status, warning_no, version
      FROM disease_warnings
      WHERE greenhouse_id = ?
      ORDER BY detected_date
    `, [greenhouseId], (err, rows) => {
      if (err) return reject(err);
      
      const inconsistencies = [];
      
      rows.forEach((row, index) => {
        if (row.version < 1) {
          inconsistencies.push({
            warningNo: row.warning_no,
            issue: '版本号不合法',
            expected: '>= 1',
            actual: row.version
          });
        }
      });
      
      if (inconsistencies.length > 0) {
        reject(new AppError(
          `预警清单一致性检查失败：发现${inconsistencies.length}处不一致`,
          409,
          errorCodes.WARNING_INCONSISTENCY,
          {
            greenhouseId,
            inconsistencies,
            totalWarnings: rows.length
          }
        ));
      }
      
      resolve(rows);
    });
  });
}

async function checkDuplicateWarningNo(warningNo, excludeId = null) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT id, warning_no FROM disease_warnings WHERE warning_no = ?';
    let params = [warningNo];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        reject(new AppError(
          `预警编号重复：${warningNo}已存在`,
          409,
          errorCodes.DUPLICATE_WARNING_NO,
          {
            existingWarningId: row.id,
            duplicateWarningNo: warningNo
          }
        ));
      }
      resolve();
    });
  });
}

async function checkSilentOverwrite(warningId, currentVersion) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT version, status, warning_no
      FROM disease_warnings
      WHERE id = ?
    `, [warningId], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        reject(new AppError(
          `预警记录不存在：${warningId}`,
          404,
          errorCodes.WARNING_NOT_FOUND
        ));
        return;
      }
      
      if (row.version !== currentVersion) {
        reject(new AppError(
          `禁止静默覆盖：预警${row.warning_no}当前版本为${row.version}，您尝试修改版本${currentVersion}`,
          409,
          errorCodes.SILENT_OVERWRITE_ATTEMPT,
          {
            warningId,
            warningNo: row.warning_no,
            currentVersion: row.version,
            requestedVersion: currentVersion,
            suggestion: '请刷新数据后重试，确保基于最新版本修改'
          }
        ));
      }
      resolve(row);
    });
  });
}

function validateSeverityLevel(severity) {
  const validLevels = ['low', 'medium', 'high', 'critical'];
  if (!validLevels.includes(severity)) {
    throw new AppError(
      `无效的严重级别：${severity}，有效值为：${validLevels.join(', ')}`,
      400,
      errorCodes.INVALID_SEVERITY_LEVEL,
      { invalidValue: severity, validValues: validLevels }
    );
  }
  return true;
}

function validateStatus(status) {
  const validStatuses = ['pending', 'confirmed', 'resolved', 'withdrawn', 'reapplied'];
  if (!validStatuses.includes(status)) {
    throw new AppError(
      `无效的状态：${status}，有效值为：${validStatuses.join(', ')}`,
      400,
      errorCodes.INVALID_STATUS,
      { invalidValue: status, validValues: validStatuses }
    );
  }
  return true;
}

async function recordHistory(warningId, fieldChanged, oldValue, newValue, changedBy) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO warning_history (warning_id, field_changed, old_value, new_value, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `, [warningId, fieldChanged, String(oldValue), String(newValue), changedBy], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

module.exports = {
  checkSeverityUpgrade,
  checkConsecutiveWarningConflict,
  checkWarningConsistency,
  checkDuplicateWarningNo,
  checkSilentOverwrite,
  validateSeverityLevel,
  validateStatus,
  recordHistory
};