const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function promisifyQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function promisifyRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function checkCertificateLocked(sessionId, employeeId) {
  const certs = await promisifyQuery(
    db,
    'SELECT * FROM certificates WHERE session_id = ? AND employee_id = ? AND status = "active"',
    [sessionId, employeeId]
  );
  return certs.length > 0;
}

async function checkRegistration(sessionId, employeeId) {
  const regs = await promisifyQuery(
    db,
    'SELECT * FROM registrations WHERE session_id = ? AND employee_id = ? AND status = "registered"',
    [sessionId, employeeId]
  );
  return regs.length > 0;
}

async function checkDuplicateRegistration(sessionId, employeeId) {
  const regs = await promisifyQuery(
    db,
    'SELECT * FROM registrations WHERE session_id = ? AND employee_id = ?',
    [sessionId, employeeId]
  );
  return regs.length > 0;
}

async function getSession(sessionId) {
  const sessions = await promisifyQuery(
    db,
    'SELECT * FROM training_sessions WHERE id = ?',
    [sessionId]
  );
  return sessions[0] || null;
}

function calculateIsLate(checkinTime, sessionStartTime, graceMinutes) {
  const checkin = new Date(checkinTime);
  const start = new Date(sessionStartTime);
  const graceEnd = new Date(start.getTime() + graceMinutes * 60000);
  return checkin > graceEnd;
}

function determineCheckinStatus(isLate) {
  return isLate ? 'pending_approval' : 'approved';
}

async function canIssueCertificate(sessionId, employeeId) {
  const approvedCheckins = await promisifyQuery(
    db,
    'SELECT * FROM checkins WHERE session_id = ? AND employee_id = ? AND status = "approved"',
    [sessionId, employeeId]
  );
  if (approvedCheckins.length === 0) return { canIssue: false, reason: '签到未通过或待审核' };

  const passedExams = await promisifyQuery(
    db,
    'SELECT * FROM exams WHERE session_id = ? AND employee_id = ? AND is_passed = 1 ORDER BY attempt DESC LIMIT 1',
    [sessionId, employeeId]
  );
  if (passedExams.length === 0) return { canIssue: false, reason: '没有通过的考试记录' };

  return { canIssue: true, exam: passedExams[0] };
}

async function updateCertificateStatusOnRetakePass(sessionId, employeeId, examId) {
  const certs = await promisifyQuery(
    db,
    'SELECT * FROM certificates WHERE session_id = ? AND employee_id = ?',
    [sessionId, employeeId]
  );
  
  if (certs.length > 0) {
    await promisifyRun(
      db,
      'UPDATE certificates SET exam_id = ?, issued_at = CURRENT_TIMESTAMP WHERE session_id = ? AND employee_id = ?',
      [examId, sessionId, employeeId]
    );
    return { updated: true, certificate: certs[0] };
  }
  return { updated: false };
}

module.exports = {
  promisifyQuery,
  promisifyRun,
  checkCertificateLocked,
  checkRegistration,
  checkDuplicateRegistration,
  getSession,
  calculateIsLate,
  determineCheckinStatus,
  canIssueCertificate,
  updateCertificateStatusOnRetakePass,
  uuidv4
};
