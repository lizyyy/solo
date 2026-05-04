const db = require('../database');

async function saveFeedback(items) {
  await db.run(`DELETE FROM feedback`);
  
  const stmt = db.getDB().prepare(`
    INSERT INTO feedback (student, question, category, status, response, submitted_at, closed_at, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of items) {
    stmt.run([
      item.student,
      item.question,
      item.category,
      item.status || 'pending',
      item.response,
      item.submittedAt,
      item.closedAt,
      JSON.stringify(item.tags || [])
    ]);
  }
  
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getAllFeedback() {
  const rows = await db.all(`SELECT * FROM feedback ORDER BY id ASC`);
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

async function getFeedbackById(id) {
  const row = await db.get(`SELECT * FROM feedback WHERE id = ?`, [id]);
  if (row) {
    row.tags = JSON.parse(row.tags || '[]');
  }
  return row;
}

async function getFeedbackCount() {
  const result = await db.get(`SELECT COUNT(*) as count FROM feedback`);
  return result ? result.count : 0;
}

async function getPendingFeedback() {
  const rows = await db.all(
    `SELECT * FROM feedback WHERE status = 'pending' OR status IS NULL ORDER BY id ASC`
  );
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

async function updateFeedbackStatus(id, status, response, closedAt) {
  return db.run(
    `UPDATE feedback SET status = ?, response = ?, closed_at = ? WHERE id = ?`,
    [status, response || '', closedAt || '', id]
  );
}

async function checkFeedbackClosedLoop() {
  const feedback = await getAllFeedback();
  const issues = [];
  
  for (const item of feedback) {
    const isClosed = item.status === 'closed' || item.status === 'resolved';
    const hasResponse = item.response && item.response.trim().length > 0;
    
    if (isClosed && !hasResponse) {
      issues.push({
        feedback: item,
        issue: '反馈标记为已闭环但没有回复内容'
      });
    }
    
    if (!isClosed && item.status !== 'pending' && item.status) {
      issues.push({
        feedback: item,
        issue: '反馈状态异常，未明确标记为待处理或已闭环'
      });
    }
  }
  
  return issues;
}

module.exports = {
  saveFeedback,
  getAllFeedback,
  getFeedbackById,
  getFeedbackCount,
  getPendingFeedback,
  updateFeedbackStatus,
  checkFeedbackClosedLoop
};
