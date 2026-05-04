const db = require('../database');

const ISSUE_TYPES = {
  TIME_OVERLAP: 'time_overlap',
  VOCABULARY_MISSING: 'vocabulary_missing',
  SEGMENT_ORDER: 'segment_order',
  FEEDBACK_LOOP: 'feedback_loop',
  SUBTITLE_EMPTY: 'subtitle_empty',
  SUBTITLE_LONG: 'subtitle_long'
};

const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

async function saveIssue(issue) {
  const result = await db.run(`
    INSERT INTO issues (type, severity, title, description, related_item_id, related_item_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    issue.type,
    issue.severity || SEVERITY_LEVELS.WARNING,
    issue.title,
    issue.description,
    issue.relatedItemId || null,
    issue.relatedItemType || null,
    issue.status || 'open'
  ]);
  return result.lastID;
}

async function saveIssues(issues) {
  await db.run(`DELETE FROM issues`);
  
  const ids = [];
  for (const issue of issues) {
    const id = await saveIssue(issue);
    ids.push(id);
  }
  return ids;
}

async function getAllIssues() {
  return db.all(`SELECT * FROM issues ORDER BY created_at DESC`);
}

async function getIssuesByType(type) {
  return db.all(`SELECT * FROM issues WHERE type = ? ORDER BY created_at DESC`, [type]);
}

async function getIssuesByStatus(status) {
  return db.all(`SELECT * FROM issues WHERE status = ? ORDER BY created_at DESC`, [status]);
}

async function getIssueById(id) {
  return db.get(`SELECT * FROM issues WHERE id = ?`, [id]);
}

async function updateIssueStatus(id, status, comment) {
  return db.run(`
    UPDATE issues 
    SET status = ?, comment = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [status, comment || '', id]);
}

async function getIssueCount() {
  const result = await db.get(`SELECT COUNT(*) as count FROM issues`);
  return result ? result.count : 0;
}

async function getIssueStats() {
  const total = await getIssueCount();
  
  const byType = await db.all(`
    SELECT type, COUNT(*) as count 
    FROM issues 
    GROUP BY type 
    ORDER BY count DESC
  `);
  
  const byStatus = await db.all(`
    SELECT status, COUNT(*) as count 
    FROM issues 
    GROUP BY status 
    ORDER BY count DESC
  `);
  
  const bySeverity = await db.all(`
    SELECT severity, COUNT(*) as count 
    FROM issues 
    GROUP BY severity 
    ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        WHEN 'info' THEN 3 
        ELSE 4 
      END
  `);
  
  return {
    total,
    byType,
    byStatus,
    bySeverity
  };
}

module.exports = {
  ISSUE_TYPES,
  SEVERITY_LEVELS,
  saveIssue,
  saveIssues,
  getAllIssues,
  getIssuesByType,
  getIssuesByStatus,
  getIssueById,
  updateIssueStatus,
  getIssueCount,
  getIssueStats
};
