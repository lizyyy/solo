const db = require('./db');

const LOCK_STATUS = {
  PENDING: 'PENDING',
  INTERVIEWING: 'INTERVIEWING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  TIMEOUT: 'TIMEOUT'
};

const INTERVIEW_RESULT = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  FAILED: 'FAILED'
};

const DEFAULT_LOCK_DURATION_MINUTES = 60;

async function createPosition(name, totalQuota) {
  const existing = await db.getQuery('SELECT * FROM positions WHERE name = ?', [name]);
  if (existing) {
    throw new Error(`岗位「${name}」已存在`);
  }

  await db.runQuery(
    'INSERT INTO positions (name, total_quota, available_quota) VALUES (?, ?, ?)',
    [name, totalQuota, totalQuota]
  );

  return { success: true, message: `岗位「${name}」创建成功，总名额：${totalQuota}` };
}

async function listPositions() {
  const positions = await db.allQuery(`
    SELECT 
      p.id,
      p.name,
      p.total_quota,
      p.available_quota,
      (SELECT COUNT(*) FROM locks l WHERE l.position_id = p.id AND l.status IN ('PENDING', 'INTERVIEWING')) as pending_locks,
      (SELECT COUNT(*) FROM locks l WHERE l.position_id = p.id AND l.status = 'ACCEPTED') as accepted_count,
      p.is_active
    FROM positions p
    ORDER BY p.id DESC
  `);
  return positions;
}

async function createLock(positionName, college, studentName, lockDurationMinutes = DEFAULT_LOCK_DURATION_MINUTES) {
  const position = await db.getQuery('SELECT * FROM positions WHERE name = ?', [positionName]);
  if (!position) {
    throw new Error(`岗位「${positionName}」不存在`);
  }

  const existingLock = await db.getQuery(
    `SELECT * FROM locks 
     WHERE position_id = ? AND college = ? AND student_name = ? 
     AND status NOT IN ('WITHDRAWN', 'TIMEOUT', 'REJECTED')`,
    [position.id, college, studentName]
  );

  if (existingLock) {
    throw new Error(`学生「${studentName}」已存在有效的推荐锁定，状态：${existingLock.status}`);
  }

  const available = await db.getQuery(`
    SELECT 
      p.available_quota,
      (SELECT COUNT(*) FROM locks l WHERE l.position_id = ? AND l.status IN ('PENDING', 'INTERVIEWING', 'ACCEPTED')) as used_count
    FROM positions p WHERE p.id = ?
  `, [position.id, position.id]);

  if (available.available_quota <= 0) {
    throw new Error(`岗位「${positionName}」名额已满，可用名额：0`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);

  await db.runQuery('BEGIN TRANSACTION');
  
  try {
    await db.runQuery(
      `INSERT INTO locks (position_id, college, student_name, status, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [position.id, college, studentName, LOCK_STATUS.PENDING, expiresAt.toISOString()]
    );

    await db.runQuery(
      'INSERT INTO interviews (lock_id, round, result) VALUES (last_insert_rowid(), 1, ?)',
      [INTERVIEW_RESULT.PENDING]
    );

    await db.runQuery(
      'UPDATE positions SET available_quota = available_quota - 1 WHERE id = ?',
      [position.id]
    );

    await db.runQuery(
      `INSERT INTO audit_logs (position_id, college, student_name, action, details) 
       VALUES (?, ?, ?, 'CREATE_LOCK', ?)`,
      [position.id, college, studentName, `锁定${lockDurationMinutes}分钟，面试轮次：1`]
    );

    await db.runQuery('COMMIT');

    return {
      success: true,
      message: `推荐锁定成功：${college} - ${studentName} -> ${positionName}`,
      details: {
        expiresAt: expiresAt.toLocaleString('zh-CN'),
        interviewRound: 1
      }
    };
  } catch (err) {
    await db.runQuery('ROLLBACK');
    throw err;
  }
}

async function updateInterview(positionName, college, studentName, round, result, notes = '') {
  const position = await db.getQuery('SELECT * FROM positions WHERE name = ?', [positionName]);
  if (!position) {
    throw new Error(`岗位「${positionName}」不存在`);
  }

  const lock = await db.getQuery(
    `SELECT * FROM locks 
     WHERE position_id = ? AND college = ? AND student_name = ? 
     AND status NOT IN ('WITHDRAWN', 'TIMEOUT', 'REJECTED', 'ACCEPTED')`,
    [position.id, college, studentName]
  );

  if (!lock) {
    throw new Error(`未找到有效的推荐锁定记录`);
  }

  const interview = await db.getQuery(
    'SELECT * FROM interviews WHERE lock_id = ? AND round = ?',
    [lock.id, round]
  );

  if (!interview) {
    throw new Error(`第${round}轮面试记录不存在`);
  }

  if (interview.result !== INTERVIEW_RESULT.PENDING) {
    throw new Error(`第${round}轮面试已完成，状态：${interview.result}`);
  }

  let newLockStatus = LOCK_STATUS.INTERVIEWING;
  let details = `第${round}轮面试结果：${result}`;

  if (result === INTERVIEW_RESULT.FAILED) {
    newLockStatus = LOCK_STATUS.REJECTED;
  }

  await db.runQuery('BEGIN TRANSACTION');

  try {
    await db.runQuery(
      'UPDATE interviews SET result = ?, notes = ? WHERE id = ?',
      [result, notes, interview.id]
    );

    if (result === INTERVIEW_RESULT.PASSED) {
      const nextRound = round + 1;
      if (nextRound <= 3) {
        await db.runQuery(
          'INSERT INTO interviews (lock_id, round, result) VALUES (?, ?, ?)',
          [lock.id, nextRound, INTERVIEW_RESULT.PENDING]
        );
        details += `，准备第${nextRound}轮面试`;
      }
    }

    await db.runQuery(
      'UPDATE locks SET status = ?, interview_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newLockStatus, round, lock.id]
    );

    if (result === INTERVIEW_RESULT.FAILED) {
      await db.runQuery(
        'UPDATE positions SET available_quota = available_quota + 1 WHERE id = ?',
        [position.id]
      );
      details += '，名额已释放';
    }

    await db.runQuery(
      `INSERT INTO audit_logs (lock_id, position_id, college, student_name, action, details) 
       VALUES (?, ?, ?, ?, 'UPDATE_INTERVIEW', ?)`,
      [lock.id, position.id, college, studentName, details]
    );

    await db.runQuery('COMMIT');

    return {
      success: true,
      message: details,
      lockStatus: newLockStatus
    };
  } catch (err) {
    await db.runQuery('ROLLBACK');
    throw err;
  }
}

async function confirmAcceptance(positionName, college, studentName) {
  const position = await db.getQuery('SELECT * FROM positions WHERE name = ?', [positionName]);
  if (!position) {
    throw new Error(`岗位「${positionName}」不存在`);
  }

  const lock = await db.getQuery(
    `SELECT * FROM locks 
     WHERE position_id = ? AND college = ? AND student_name = ? 
     AND status IN ('PENDING', 'INTERVIEWING')`,
    [position.id, college, studentName]
  );

  if (!lock) {
    throw new Error(`未找到可确认的推荐锁定记录`);
  }

  const interviews = await db.allQuery(
    'SELECT * FROM interviews WHERE lock_id = ? ORDER BY round',
    [lock.id]
  );

  const hasFailed = interviews.some(i => i.result === INTERVIEW_RESULT.FAILED);
  if (hasFailed) {
    throw new Error(`存在未通过的面试，无法确认录用`);
  }

  await db.runQuery('BEGIN TRANSACTION');

  try {
    await db.runQuery(
      'UPDATE locks SET status = ?, updated_at = CURRENT_TIMESTAMP, expires_at = NULL WHERE id = ?',
      [LOCK_STATUS.ACCEPTED, lock.id]
    );

    await db.runQuery(
      `INSERT INTO audit_logs (lock_id, position_id, college, student_name, action, details) 
       VALUES (?, ?, ?, ?, 'CONFIRM_ACCEPTANCE', '录用确认')`,
      [lock.id, position.id, college, studentName]
    );

    await db.runQuery('COMMIT');

    return {
      success: true,
      message: `录用确认成功：${college} - ${studentName} -> ${positionName}`
    };
  } catch (err) {
    await db.runQuery('ROLLBACK');
    throw err;
  }
}

async function withdrawLock(positionName, college, studentName, reason = '') {
  const position = await db.getQuery('SELECT * FROM positions WHERE name = ?', [positionName]);
  if (!position) {
    throw new Error(`岗位「${positionName}」不存在`);
  }

  const lock = await db.getQuery(
    `SELECT * FROM locks 
     WHERE position_id = ? AND college = ? AND student_name = ? 
     AND status IN ('PENDING', 'INTERVIEWING')`,
    [position.id, college, studentName]
  );

  if (!lock) {
    throw new Error(`未找到可撤回的推荐锁定记录`);
  }

  await db.runQuery('BEGIN TRANSACTION');

  try {
    await db.runQuery(
      'UPDATE locks SET status = ?, updated_at = CURRENT_TIMESTAMP, expires_at = NULL WHERE id = ?',
      [LOCK_STATUS.WITHDRAWN, lock.id]
    );

    await db.runQuery(
      'UPDATE positions SET available_quota = available_quota + 1 WHERE id = ?',
      [position.id]
    );

    const details = `撤回原因：${reason || '未说明'}`;
    await db.runQuery(
      `INSERT INTO audit_logs (lock_id, position_id, college, student_name, action, details) 
       VALUES (?, ?, ?, ?, 'WITHDRAW', ?)`,
      [lock.id, position.id, college, studentName, details]
    );

    await db.runQuery('COMMIT');

    return {
      success: true,
      message: `撤回成功：${college} - ${studentName} -> ${positionName}，名额已释放`
    };
  } catch (err) {
    await db.runQuery('ROLLBACK');
    throw err;
  }
}

async function processTimeout() {
  const now = new Date().toISOString();
  const timeoutLocks = await db.allQuery(
    `SELECT l.*, p.name as position_name 
     FROM locks l JOIN positions p ON l.position_id = p.id 
     WHERE l.status = ? AND l.expires_at < ?`,
    [LOCK_STATUS.PENDING, now]
  );

  const results = [];

  for (const lock of timeoutLocks) {
    await db.runQuery('BEGIN TRANSACTION');
    
    try {
      await db.runQuery(
        'UPDATE locks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [LOCK_STATUS.TIMEOUT, lock.id]
      );

      await db.runQuery(
        'UPDATE positions SET available_quota = available_quota + 1 WHERE id = ?',
        [lock.position_id]
      );

      await db.runQuery(
        `INSERT INTO audit_logs (lock_id, position_id, college, student_name, action, details) 
         VALUES (?, ?, ?, ?, 'TIMEOUT', ?)`,
        [lock.id, lock.position_id, lock.college, lock.student_name, 
         `推荐锁定超时自动释放，原过期时间：${lock.expires_at}`]
      );

      await db.runQuery('COMMIT');

      results.push({
        college: lock.college,
        studentName: lock.student_name,
        positionName: lock.position_name
      });
    } catch (err) {
      await db.runQuery('ROLLBACK');
      console.error('处理超时时出错:', err);
    }
  }

  return results;
}

async function getCollegeStats() {
  const stats = await db.allQuery(`
    SELECT 
      college,
      COUNT(*) as total_locks,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'INTERVIEWING' THEN 1 ELSE 0 END) as interviewing,
      SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'WITHDRAWN' THEN 1 ELSE 0 END) as withdrawn,
      SUM(CASE WHEN status = 'TIMEOUT' THEN 1 ELSE 0 END) as timeout
    FROM locks
    GROUP BY college
    ORDER BY college
  `);

  return stats.map(s => ({
    college: s.college,
    total: s.total_locks,
    pending: s.pending || 0,
    interviewing: s.interviewing || 0,
    accepted: s.accepted || 0,
    rejected: s.rejected || 0,
    withdrawn: s.withdrawn || 0,
    timeout: s.timeout || 0
  }));
}

async function listLocks(college = null, status = null) {
  let sql = `
    SELECT 
      l.id,
      l.college,
      l.student_name,
      p.name as position_name,
      l.status,
      l.interview_count,
      l.created_at,
      l.updated_at,
      l.expires_at
    FROM locks l
    JOIN positions p ON l.position_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (college) {
    sql += ' AND l.college = ?';
    params.push(college);
  }

  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY l.updated_at DESC';

  const locks = await db.allQuery(sql, params);
  return locks;
}

async function listAuditLogs(limit = 50) {
  const logs = await db.allQuery(`
    SELECT 
      al.id,
      al.action,
      al.college,
      al.student_name,
      (SELECT name FROM positions WHERE id = al.position_id) as position_name,
      al.details,
      al.created_at
    FROM audit_logs al
    ORDER BY al.id DESC
    LIMIT ?
  `, [limit]);

  return logs;
}

module.exports = {
  LOCK_STATUS,
  INTERVIEW_RESULT,
  DEFAULT_LOCK_DURATION_MINUTES,
  createPosition,
  listPositions,
  createLock,
  updateInterview,
  confirmAcceptance,
  withdrawLock,
  processTimeout,
  getCollegeStats,
  listLocks,
  listAuditLogs
};
