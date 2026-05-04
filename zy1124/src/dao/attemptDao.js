const { run, get, all } = require('../db');

async function createAttempt(data) {
  const result = await run(`
    INSERT INTO processing_attempts (
      event_id, attempt_number, status, error_message, is_replay
    ) VALUES (?, ?, ?, ?, ?)
  `, [
    data.event_id,
    data.attempt_number,
    data.status,
    data.error_message || null,
    data.is_replay ? 1 : 0
  ]);
  
  return getAttemptById(result.lastID);
}

async function getAttemptById(id) {
  return get('SELECT * FROM processing_attempts WHERE id = ?', [id]);
}

async function getAttemptsByEventId(eventId) {
  return all(`
    SELECT * FROM processing_attempts 
    WHERE event_id = ? 
    ORDER BY attempt_number ASC
  `, [eventId]);
}

async function updateAttempt(id, data) {
  const updates = [];
  const values = [];
  
  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.error_message !== undefined) {
    updates.push('error_message = ?');
    values.push(data.error_message);
  }
  if (data.ended_at !== undefined) {
    updates.push('ended_at = ?');
    values.push(data.ended_at);
  }
  if (data.duration_ms !== undefined) {
    updates.push('duration_ms = ?');
    values.push(data.duration_ms);
  }
  
  if (updates.length === 0) return getAttemptById(id);
  
  values.push(id);
  await run(`UPDATE processing_attempts SET ${updates.join(', ')} WHERE id = ?`, values);
  
  return getAttemptById(id);
}

async function getLatestAttemptByEventId(eventId) {
  return get(`
    SELECT * FROM processing_attempts 
    WHERE event_id = ? 
    ORDER BY attempt_number DESC 
    LIMIT 1
  `, [eventId]);
}

async function getFailureReasons(since, until) {
  let sql = `
    SELECT 
      error_message,
      COUNT(*) as count
    FROM processing_attempts
    WHERE status = 'failed' AND error_message IS NOT NULL
  `;
  const values = [];
  
  if (since) {
    sql += ' AND started_at >= ?';
    values.push(since);
  }
  if (until) {
    sql += ' AND started_at <= ?';
    values.push(until);
  }
  
  sql += ' GROUP BY error_message ORDER BY count DESC';
  
  return all(sql, values);
}

async function getAttemptStatistics(since, until) {
  let sql = `
    SELECT 
      status,
      COUNT(*) as count,
      AVG(duration_ms) as avg_duration_ms
    FROM processing_attempts
    WHERE 1=1
  `;
  const values = [];
  
  if (since) {
    sql += ' AND started_at >= ?';
    values.push(since);
  }
  if (until) {
    sql += ' AND started_at <= ?';
    values.push(until);
  }
  
  sql += ' GROUP BY status';
  
  return all(sql, values);
}

module.exports = {
  createAttempt,
  getAttemptById,
  getAttemptsByEventId,
  updateAttempt,
  getLatestAttemptByEventId,
  getFailureReasons,
  getAttemptStatistics,
};
