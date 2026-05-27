const db = require('../db');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const config = require('../config');

function ensureDir(p) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function buildSummary(filters = {}) {
  const where = [];
  const params = [];
  if (filters.team) { where.push('q.team = ?'); params.push(filters.team); }
  if (filters.agentId) { where.push('q.agent_id = ?'); params.push(filters.agentId); }
  if (filters.startDate) { where.push('q.call_date >= ?'); params.push(filters.startDate); }
  if (filters.endDate) { where.push('q.call_date <= ?'); params.push(filters.endDate); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM qa_items q ${whereSql}`).get(...params).c;
  const avg = db.prepare(`SELECT AVG(score_final) AS a FROM qa_items q ${whereSql}`).get(...params).a || 0;
  const appealed = db.prepare(`SELECT COUNT(*) AS c FROM qa_items q ${whereSql ? whereSql + ' AND ' : 'WHERE '} q.status = 'appealed' OR q.status = 'revised'`).get(...params).c;
  const revised = db.prepare(`SELECT COUNT(*) AS c FROM qa_items q ${whereSql ? whereSql + ' AND ' : 'WHERE '} q.status = 'revised'`).get(...params).c;

  const deductionsByRule = db.prepare(`
    SELECT d.rule_code, d.rule_name, COUNT(*) AS cnt, SUM(d.points_deducted) AS sum_points
    FROM deductions d JOIN qa_items q ON q.id = d.qa_item_id
    ${whereSql ? 'AND ' + whereSql.replace(/q\./g, 'q.') : ''}
    WHERE d.is_revoked = 0
    GROUP BY d.rule_code, d.rule_name
    ORDER BY sum_points DESC
  `).all(...params);

  const byTeam = db.prepare(`
    SELECT q.team, COUNT(*) AS cnt, AVG(q.score_final) AS avg_score
    FROM qa_items q ${whereSql}
    GROUP BY q.team
  `).all(...params);

  return {
    total_records: total,
    average_score: Number(avg.toFixed(2)),
    appealed_count: appealed,
    revised_count: revised,
    deductions_by_rule: deductionsByRule,
    by_team: byTeam,
    filters
  };
}

function listDetails(filters = {}) {
  const where = [];
  const params = [];
  if (filters.team) { where.push('q.team = ?'); params.push(filters.team); }
  if (filters.agentId) { where.push('q.agent_id = ?'); params.push(filters.agentId); }
  if (filters.startDate) { where.push('q.call_date >= ?'); params.push(filters.startDate); }
  if (filters.endDate) { where.push('q.call_date <= ?'); params.push(filters.endDate); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT q.id, q.call_id, q.agent_id, q.agent_name, q.team, q.call_date, q.score_total, q.score_final, q.status
    FROM qa_items q ${whereSql}
    ORDER BY q.call_date DESC
  `).all(...params);

  for (const r of rows) {
    r.deductions = db.prepare('SELECT rule_code, rule_name, points_deducted, is_revoked FROM deductions WHERE qa_item_id = ?').all(r.id);
    r.summary = db.prepare('SELECT summary, emotion, keywords FROM call_summaries WHERE call_id = ?').get(r.call_id) || null;
  }
  return rows;
}

function exportCsv(filters = {}) {
  const details = listDetails(filters);
  const header = ['call_id', 'agent_id', 'agent_name', 'team', 'call_date', 'score_total', 'score_final', 'delta', 'status', 'deductions', 'revoked_count', 'summary_emotion'];
  const lines = [header.join(',')];
  for (const r of details) {
    const deductions = r.deductions.filter(d => !d.is_revoked).map(d => `${d.rule_code}(${d.points_deducted})`).join('|');
    const revokedCount = r.deductions.filter(d => d.is_revoked).length;
    const delta = r.score_final - r.score_total;
    lines.push([
      r.call_id, r.agent_id, r.agent_name, r.team, r.call_date,
      r.score_total, r.score_final, delta, r.status,
      `"${deductions.replace(/"/g, '""')}"`,
      revokedCount,
      r.summary?.emotion || ''
    ].join(','));
  }
  const buf = Buffer.from(lines.join('\n'), 'utf8');
  const fileName = `qa-report-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
  const filePath = path.join(config.reportDir, fileName);
  ensureDir(filePath);
  fs.writeFileSync(filePath, buf);

  const summary = buildSummary(filters);
  const reportId = db.prepare(`
    INSERT INTO reports (report_type, filters, summary_json, file_path)
    VALUES (?, ?, ?, ?)
  `).run('csv', JSON.stringify(filters), JSON.stringify(summary), filePath).lastInsertRowid;

  return { reportId, filePath, fileName, rows: details.length };
}

module.exports = { buildSummary, listDetails, exportCsv };
