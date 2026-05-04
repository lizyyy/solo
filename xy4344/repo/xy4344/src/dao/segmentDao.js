const db = require('../database');

async function saveSegments(segments) {
  await db.run(`DELETE FROM segments`);
  
  const stmt = db.getDB().prepare(`
    INSERT INTO segments (name, order_num, start_time, end_time, duration, description, teacher, objectives)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of segments) {
    stmt.run([
      item.name,
      item.order,
      item.startTime,
      item.endTime,
      item.duration,
      item.description,
      item.teacher,
      JSON.stringify(item.objectives || [])
    ]);
  }
  
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getAllSegments() {
  const rows = await db.all(`SELECT * FROM segments ORDER BY order_num ASC`);
  return rows.map(row => ({
    ...row,
    objectives: JSON.parse(row.objectives || '[]')
  }));
}

async function getSegmentsOrdered() {
  const rows = await db.all(`SELECT * FROM segments ORDER BY order_num ASC`);
  return rows.map(row => ({
    ...row,
    objectives: JSON.parse(row.objectives || '[]')
  }));
}

async function getSegmentById(id) {
  const row = await db.get(`SELECT * FROM segments WHERE id = ?`, [id]);
  if (row) {
    row.objectives = JSON.parse(row.objectives || '[]');
  }
  return row;
}

async function getSegmentCount() {
  const result = await db.get(`SELECT COUNT(*) as count FROM segments`);
  return result ? result.count : 0;
}

async function checkSegmentOrder() {
  const segments = await getSegmentsOrdered();
  const issues = [];
  
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    if (current.order_num !== i + 1) {
      issues.push({
        segment: current,
        expectedOrder: i + 1,
        actualOrder: current.order_num
      });
    }
  }
  
  return issues;
}

module.exports = {
  saveSegments,
  getAllSegments,
  getSegmentsOrdered,
  getSegmentById,
  getSegmentCount,
  checkSegmentOrder
};
