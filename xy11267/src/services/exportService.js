const { createObjectCsvWriter } = require('csv-writer');
const { allQuery } = require('../database/db');
const { maskObject } = require('../utils/masking');
const path = require('path');
const fs = require('fs');

const exportDir = path.join(__dirname, '../../exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportToCsv(filters = {}, masked = true) {
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
  if (filters.start_date) {
    sql += ' AND created_at >= ?';
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    sql += ' AND created_at <= ?';
    params.push(filters.end_date);
  }

  sql += ' ORDER BY created_at DESC';

  const records = await allQuery(sql, params);

  const filename = `inspection_export_${Date.now()}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'record_id', title: '记录ID' },
      { id: 'session_id', title: '会话ID' },
      { id: 'operator', title: '操作人' },
      { id: 'role', title: '角色' },
      { id: 'inspection_result', title: '质检结果' },
      { id: 'risk_level', title: '风险等级' },
      { id: 'status', title: '状态' },
      { id: 'violation_summary', title: '违规摘要' },
      { id: 'transcript_preview', title: '文本预览' },
      { id: 'created_at', title: '创建时间' },
      { id: 'rule_version', title: '规则版本' }
    ]
  });

  const csvData = records.map(r => {
    const violations = JSON.parse(r.violation_details || '[]');
    const violationSummary = violations.map(v => v.reason).join('; ');
    const transcriptPreview = r.transcript_text.substring(0, 100);

    const result = {
      record_id: r.record_id,
      session_id: r.session_id,
      operator: r.operator,
      role: r.role,
      inspection_result: r.inspection_result === 'passed' ? '通过' : '未通过',
      risk_level: r.risk_level,
      status: r.status,
      violation_summary: violationSummary,
      transcript_preview: transcriptPreview,
      created_at: r.created_at,
      rule_version: r.rule_version
    };

    return masked ? maskObject(result) : result;
  });

  await csvWriter.writeRecords(csvData);
  return {
    filename,
    filepath,
    count: csvData.length
  };
}

async function exportAuditLogsToCsv(filters = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.action_type) {
    sql += ' AND action_type = ?';
    params.push(filters.action_type);
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

  const logs = await allQuery(sql, params);

  const filename = `audit_logs_export_${Date.now()}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'action_type', title: '操作类型' },
      { id: 'record_id', title: '记录ID' },
      { id: 'operator', title: '操作人' },
      { id: 'role', title: '角色' },
      { id: 'action_details', title: '操作详情' },
      { id: 'ip_address', title: 'IP地址' },
      { id: 'created_at', title: '操作时间' }
    ]
  });

  const csvData = logs.map(log => maskObject(log));

  await csvWriter.writeRecords(csvData);
  return {
    filename,
    filepath,
    count: csvData.length
  };
}

function getExportFile(filename) {
  const filepath = path.join(exportDir, filename);
  if (fs.existsSync(filepath)) {
    return filepath;
  }
  return null;
}

function listExportFiles() {
  if (!fs.existsSync(exportDir)) {
    return [];
  }
  return fs.readdirSync(exportDir).filter(f => f.endsWith('.csv')).map(f => ({
    filename: f,
    created_at: fs.statSync(path.join(exportDir, f)).mtime
  }));
}

module.exports = {
  exportToCsv,
  exportAuditLogsToCsv,
  getExportFile,
  listExportFiles
};
