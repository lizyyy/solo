const { runQuery, allQuery, getQuery } = require('../database/db');
const { inspectRecord, getCurrentRuleVersion, reloadRules } = require('./inspectionEngine');
const { logAction } = require('./auditService');
const { maskObject } = require('../utils/masking');

function generateRecordId() {
  return 'REC' + Date.now() + Math.random().toString(36).substr(2, 9);
}

async function createRecord(data, operator, role, ipAddress) {
  const recordId = generateRecordId();
  
  const inspectionResult = await inspectRecord(data);
  
  await runQuery(`
    INSERT INTO inspection_records 
    (record_id, session_id, operator, role, transcript_text, raw_data, inspection_result, risk_level, violation_details, status, rule_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    recordId,
    data.session_id,
    operator,
    role,
    data.transcript_text,
    JSON.stringify(data),
    inspectionResult.passed ? 'passed' : 'failed',
    inspectionResult.riskLevel,
    JSON.stringify(inspectionResult.violations),
    inspectionResult.passed ? 'approved' : 'pending_review',
    inspectionResult.ruleVersion
  ]);

  if (data.speakers && Array.isArray(data.speakers)) {
    for (const s of data.speakers) {
      await runQuery(`
        INSERT INTO speakers (record_id, speaker_id, start_time, end_time, text)
        VALUES (?, ?, ?, ?, ?)
      `, [recordId, s.speaker_id, s.start_time, s.end_time, s.text]);
    }
  }

  await logAction(
    'create_record',
    recordId,
    operator,
    role,
    `创建质检记录，结果：${inspectionResult.passed ? '通过' : '拦截'}，${inspectionResult.summary}`,
    ipAddress
  );

  return {
    recordId,
    ...inspectionResult
  };
}

async function getRecord(recordId, masked = true) {
  const record = await getQuery('SELECT * FROM inspection_records WHERE record_id = ?', [recordId]);
  
  if (!record) return null;

  const speakers = await allQuery('SELECT * FROM speakers WHERE record_id = ?', [recordId]);
  
  const result = {
    ...record,
    violation_details: JSON.parse(record.violation_details || '[]'),
    raw_data: JSON.parse(record.raw_data || '{}'),
    speakers
  };

  return masked ? maskObject(result) : result;
}

async function getRecords(filters = {}, masked = true) {
  let sql = 'SELECT * FROM inspection_records WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.risk_level) {
    sql += ' AND risk_level = ?';
    params.push(filters.risk_level);
  }
  if (filters.session_id) {
    sql += ' AND session_id LIKE ?';
    params.push(`%${filters.session_id}%`);
  }
  if (filters.operator) {
    sql += ' AND operator LIKE ?';
    params.push(`%${filters.operator}%`);
  }
  if (filters.start_date) {
    sql += ' AND created_at >= ?';
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    sql += ' AND created_at <= ?';
    params.push(filters.end_date);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const records = await allQuery(sql, params);
  
  return records.map(r => {
    const result = {
      ...r,
      violation_details: JSON.parse(r.violation_details || '[]')
    };
    return masked ? maskObject(result) : result;
  });
}

async function getRecordCount(filters = {}) {
  let sql = 'SELECT COUNT(*) as count FROM inspection_records WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.risk_level) {
    sql += ' AND risk_level = ?';
    params.push(filters.risk_level);
  }

  const result = await getQuery(sql, params);
  return result.count;
}

async function updateRecordStatus(recordId, newStatus, inspector, role, reason, ipAddress) {
  const result = await runQuery(`
    UPDATE inspection_records 
    SET status = ?, inspector = ?, updated_at = CURRENT_TIMESTAMP
    WHERE record_id = ?
  `, [newStatus, inspector, recordId]);
  
  if (result.changes > 0) {
    await logAction(
      'update_status',
      recordId,
      inspector,
      role,
      `更新状态为：${newStatus}，原因：${reason}`,
      ipAddress
    );
  }

  return result.changes > 0;
}

async function reRunInspection(recordId, operator, role, ipAddress) {
  const record = await getQuery('SELECT * FROM inspection_records WHERE record_id = ?', [recordId]);
  
  if (!record) return null;

  const rawData = JSON.parse(record.raw_data);
  const newResult = await inspectRecord(rawData);
  
  await runQuery(`
    UPDATE inspection_records 
    SET inspection_result = ?, risk_level = ?, violation_details = ?, 
        status = ?, rule_version = ?, updated_at = CURRENT_TIMESTAMP
    WHERE record_id = ?
  `, [
    newResult.passed ? 'passed' : 'failed',
    newResult.riskLevel,
    JSON.stringify(newResult.violations),
    newResult.passed ? 'approved' : 'pending_review',
    newResult.ruleVersion,
    recordId
  ]);

  await logAction(
    'rerun_inspection',
    recordId,
    operator,
    role,
    `规则更新后重新质检，新结果：${newResult.passed ? '通过' : '拦截'}，${newResult.summary}`,
    ipAddress
  );

  return {
    recordId,
    ...newResult
  };
}

async function reRunAllOldRecords(operator, role, ipAddress) {
  const currentVersion = await getCurrentRuleVersion();
  
  const oldRecords = await allQuery(
    'SELECT record_id FROM inspection_records WHERE rule_version < ?',
    [currentVersion]
  );

  const results = [];
  for (const r of oldRecords) {
    const result = await reRunInspection(r.record_id, operator, role, ipAddress);
    if (result) results.push(result);
  }

  return {
    processed: results.length,
    results
  };
}

async function getStatistics() {
  const total = await getQuery('SELECT COUNT(*) as count FROM inspection_records');
  const passed = await getQuery("SELECT COUNT(*) as count FROM inspection_records WHERE inspection_result = 'passed'");
  const failed = await getQuery("SELECT COUNT(*) as count FROM inspection_records WHERE inspection_result = 'failed'");
  
  const riskLevelStats = await allQuery(`
    SELECT risk_level, COUNT(*) as count 
    FROM inspection_records 
    GROUP BY risk_level
  `);

  const statusStats = await allQuery(`
    SELECT status, COUNT(*) as count 
    FROM inspection_records 
    GROUP BY status
  `);

  return {
    total: total.count,
    passed: passed.count,
    failed: failed.count,
    passRate: total.count > 0 ? ((passed.count / total.count) * 100).toFixed(2) : 0,
    riskLevelStats,
    statusStats
  };
}

module.exports = {
  createRecord,
  getRecord,
  getRecords,
  getRecordCount,
  updateRecordStatus,
  reRunInspection,
  reRunAllOldRecords,
  getStatistics
};
