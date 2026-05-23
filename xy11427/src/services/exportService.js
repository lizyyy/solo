const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const { getDatabase } = require('../config/database');
const { getQueueStats } = require('./compensationQueue');

const EXPORT_DIR = path.join(__dirname, '../../exports');
const REPORTS_DIR = path.join(__dirname, '../../reports');

function ensureDirectories() {
  if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function exportFactsToCSV(options = {}) {
  ensureDirectories();
  const db = getDatabase();
  
  const { start_date, end_date, has_dirty = null } = options;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (start_date) {
    whereClause += ' AND f.visit_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND f.visit_date <= ?';
    params.push(end_date);
  }
  if (has_dirty !== null) {
    whereClause += has_dirty 
      ? ' AND EXISTS (SELECT 1 FROM dirty_records dr WHERE dr.fact_id = f.fact_id AND dr.status = "pending")'
      : ' AND NOT EXISTS (SELECT 1 FROM dirty_records dr WHERE dr.fact_id = f.fact_id AND dr.status = "pending")';
  }
  
  const facts = db.prepare(`
    SELECT 
      f.fact_id,
      f.appointment_no,
      f.gate_record_no,
      f.screenshot_no,
      f.visitor_name,
      f.license_plate,
      f.visit_date,
      f.pass_time,
      f.is_consistent,
      f.consistency_score,
      f.status as fact_status,
      a.visit_reason,
      a.host_department,
      a.host_name,
      g.gate_name,
      g.pass_direction,
      s.is_correct as screenshot_correct
    FROM fact_records f
    LEFT JOIN visitor_appointments a ON f.appointment_no = a.appointment_no
    LEFT JOIN gate_records g ON f.gate_record_no = g.record_no
    LEFT JOIN license_plate_screenshots s ON f.screenshot_no = s.screenshot_no
    ${whereClause}
    ORDER BY f.updated_at DESC
  `).all(...params);
  
  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(facts);
  
  const filename = `facts_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filepath, csv, 'utf-8');
  
  return { filepath, filename, record_count: facts.length };
}

function exportDirtyRecordsToCSV(options = {}) {
  ensureDirectories();
  const db = getDatabase();
  
  const { status, dirty_type, start_date, end_date } = options;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  if (dirty_type) {
    whereClause += ' AND dirty_type = ?';
    params.push(dirty_type);
  }
  if (start_date) {
    whereClause += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND created_at <= ?';
    params.push(end_date);
  }
  
  const dirtyRecords = db.prepare(`
    SELECT 
      record_id,
      fact_id,
      record_type,
      record_no,
      dirty_type,
      dirty_reason,
      severity,
      status,
      handled_by,
      handled_at,
      handling_notes,
      created_at
    FROM dirty_records
    ${whereClause}
    ORDER BY created_at DESC
  `).all(...params);
  
  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(dirtyRecords);
  
  const filename = `dirty_records_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filepath, csv, 'utf-8');
  
  return { filepath, filename, record_count: dirtyRecords.length };
}

function generateSecuritySupervisorReport() {
  ensureDirectories();
  const db = getDatabase();
  
  const queueStats = getQueueStats();
  
  const retryableByType = db.prepare(`
    SELECT 
      dirty_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed,
      SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored
    FROM dirty_records
    GROUP BY dirty_type
    ORDER BY total DESC
  `).all();
  
  const deadLetterStats = db.prepare(`
    SELECT 
      record_type,
      COUNT(*) as count
    FROM dead_letter_queue
    WHERE status = 'dead'
    GROUP BY record_type
  `).all();
  
  const today = new Date().toISOString().split('T')[0];
  const dailyStats = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as new_records
    FROM fact_records
    WHERE created_at >= DATE('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();
  
  const pendingManual = db.prepare(`
    SELECT 
      q.queue_id,
      q.record_type,
      q.record_no,
      q.fact_id,
      f.visitor_name,
      q.assigned_to,
      q.retry_count,
      q.error_message
    FROM compensation_queue q
    LEFT JOIN fact_records f ON q.fact_id = f.fact_id
    WHERE q.status = 'manual'
    ORDER BY q.updated_at DESC
  `).all();
  
  const recentRecoveries = db.prepare(`
    SELECT 
      dlq.queue_id as dlq_id,
      dlq.original_queue_id,
      dlq.record_type,
      dlq.record_no,
      dlq.recovered_at,
      dlq.moved_at
    FROM dead_letter_queue dlq
    WHERE dlq.status = 'recovered'
    ORDER BY dlq.recovered_at DESC
    LIMIT 10
  `).all();
  
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      queue_status: queueStats.queue,
      dead_letter: queueStats.deadLetter,
      retryable_by_queue_type: queueStats.retryableByType
    },
    dirty_records_breakdown: retryableByType,
    dead_letter_by_type: deadLetterStats,
    daily_new_records: dailyStats,
    pending_manual_tasks: pendingManual,
    recent_dead_letter_recoveries: recentRecoveries
  };
  
  const filename = `security_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  
  const txtFilename = `security_report_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const txtFilepath = path.join(REPORTS_DIR, txtFilename);
  fs.writeFileSync(txtFilepath, formatTextReport(report), 'utf-8');
  
  return {
    json_file: filepath,
    text_file: txtFilepath,
    report
  };
}

function formatTextReport(report) {
  let txt = `
================================================================
          园区访客通行重试补偿队列 - 安保主管日报
================================================================
生成时间: ${report.generated_at}

----------------------------------------------------------------
一、队列状态汇总
----------------------------------------------------------------
`;
  
  report.summary.queue_status.forEach(s => {
    txt += `  状态: ${s.status} (可重试: ${s.retryable ? '是' : '否'}) - ${s.count} 条\n`;
  });
  
  txt += `\n死信队列:\n`;
  report.summary.dead_letter.forEach(d => {
    txt += `  ${d.status === 'dead' ? '待处理' : '已恢复'}: ${d.count} 条\n`;
  });
  
  txt += `
----------------------------------------------------------------
二、脏数据分类统计
----------------------------------------------------------------
`;
  
  report.dirty_records_breakdown.forEach(d => {
    txt += `  ${d.dirty_type}: 总计 ${d.total}, 待处理 ${d.pending}, 已修复 ${d.fixed}, 忽略 ${d.ignored}\n`;
  });
  
  txt += `
----------------------------------------------------------------
三、待人工处理任务 (${report.pending_manual_tasks.length} 条)
----------------------------------------------------------------
`;
  
  report.pending_manual_tasks.forEach((t, i) => {
    txt += `  ${i + 1}. ${t.record_type} - ${t.record_no}\n`;
    txt += `     访客: ${t.visitor_name || '未知'}\n`;
    txt += `     重试次数: ${t.retry_count}\n`;
    txt += `     错误: ${t.error_message || '无'}\n\n`;
  });
  
  txt += `
================================================================
                          报告结束
================================================================
`;
  
  return txt;
}

module.exports = {
  exportFactsToCSV,
  exportDirtyRecordsToCSV,
  generateSecuritySupervisorReport
};
