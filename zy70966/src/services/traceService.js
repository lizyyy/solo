const db = require('../db');

function traceFromDetail(qaItemId) {
  const qa = db.prepare('SELECT * FROM qa_items WHERE id = ?').get(qaItemId);
  if (!qa) return null;

  const imports = db.prepare('SELECT * FROM imports WHERE id = ?').get(qa.import_id);
  const summary = db.prepare('SELECT * FROM call_summaries WHERE call_id = ?').get(qa.call_id);
  const deductions = db.prepare('SELECT * FROM deductions WHERE qa_item_id = ? ORDER BY created_at').all(qaItemId);
  const appeals = db.prepare('SELECT * FROM appeals WHERE qa_item_id = ? ORDER BY created_at').all(qaItemId);
  const appealIds = appeals.map(a => a.id);
  const reviews = appealIds.length
    ? db.prepare(`SELECT * FROM reviews WHERE appeal_id IN (${appealIds.map(() => '?').join(',')}) ORDER BY created_at`).all(...appealIds)
    : [];
  const snapshots = db.prepare('SELECT * FROM score_snapshots WHERE qa_item_id = ? ORDER BY created_at').all(qaItemId);
  const audit = db.prepare('SELECT * FROM audit_log WHERE qa_item_id = ? ORDER BY created_at').all(qaItemId);
  const reports = db.prepare(`
    SELECT id, report_type, created_at, file_path
    FROM reports
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(qa.created_at);

  return {
    qa,
    import: imports || null,
    summary: summary || null,
    deductions,
    appeals,
    reviews,
    score_snapshots: snapshots,
    audit_log: audit,
    related_reports: reports
  };
}

function traceFromReport(reportId) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  if (!report) return null;
  const filters = report.filters ? JSON.parse(report.filters) : {};
  const summary = report.summary_json ? JSON.parse(report.summary_json) : null;
  return { report, filters, summary };
}

module.exports = { traceFromDetail, traceFromReport };
