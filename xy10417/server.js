const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const initSQL = require('./db/init.js');
const seedSQL = require('./db/seed.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db;
const dbPath = path.join(__dirname, 'db', 'interview.db');

async function initDB() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('数据库已从文件加载');
  } else {
    db = new SQL.Database();
    db.run(initSQL);
    db.run(seedSQL);
    saveDB();
    console.log('数据库已初始化并导入样例数据');
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  const lastId = query('SELECT last_insert_rowid() as id')[0].id;
  return { lastInsertRowid: lastId, changes: db.getRowsModified() };
}

const addTimeline = (interviewId, candidateId, action, details, actor = '系统') => {
  run(`INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (?, ?, ?, ?, ?)`, 
      [interviewId, candidateId, action, details, actor]);
};

const updateCandidateRisk = (candidateId) => {
  const candidates = query(`SELECT no_show_count, is_blacklisted FROM candidates WHERE id = ?`, [candidateId]);
  if (candidates.length === 0) return;
  
  const candidate = candidates[0];
  let riskLevel = 'normal';
  if (candidate.is_blacklisted) {
    riskLevel = 'blacklisted';
  } else if (candidate.no_show_count >= 2) {
    riskLevel = 'high';
  } else if (candidate.no_show_count === 1) {
    riskLevel = 'medium';
  }
  
  run(`UPDATE candidates SET risk_level = ? WHERE id = ?`, [riskLevel, candidateId]);
};

app.get('/api/positions', (req, res) => {
  const positions = query(`SELECT * FROM positions ORDER BY created_at DESC`);
  res.json(positions);
});

app.post('/api/positions', (req, res) => {
  const { name, department, hr_name } = req.body;
  const result = run(`INSERT INTO positions (name, department, hr_name) VALUES (?, ?, ?)`, [name, department, hr_name]);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/hrs', (req, res) => {
  const posHRs = query(`SELECT DISTINCT hr_name FROM positions`);
  const intHRs = query(`SELECT DISTINCT hr_name FROM interviews`);
  const hrsSet = new Set();
  posHRs.forEach(h => hrsSet.add(h.hr_name));
  intHRs.forEach(h => hrsSet.add(h.hr_name));
  res.json(Array.from(hrsSet));
});

app.get('/api/candidates', (req, res) => {
  const candidates = query(`SELECT * FROM candidates ORDER BY created_at DESC`);
  res.json(candidates);
});

app.post('/api/candidates', (req, res) => {
  const { name, phone, email } = req.body;
  const result = run(`INSERT INTO candidates (name, phone, email) VALUES (?, ?, ?)`, [name, phone, email]);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/interviews', (req, res) => {
  const { position_id, hr_name } = req.query;
  let sql = `SELECT i.*, p.name as position_name, p.department, c.name as candidate_name, c.phone, c.email, c.no_show_count, c.risk_level, c.is_blacklisted
             FROM interviews i
             JOIN positions p ON i.position_id = p.id
             JOIN candidates c ON i.candidate_id = c.id
             WHERE 1=1`;
  const params = [];
  
  if (position_id) {
    sql += ` AND i.position_id = ?`;
    params.push(parseInt(position_id));
  }
  if (hr_name) {
    sql += ` AND i.hr_name = ?`;
    params.push(hr_name);
  }
  
  sql += ` ORDER BY i.scheduled_time DESC`;
  const interviews = query(sql, params);
  res.json(interviews);
});

app.post('/api/interviews', (req, res) => {
  const { position_id, candidate_id, hr_name, scheduled_time, notes } = req.body;
  
  const candidates = query(`SELECT * FROM candidates WHERE id = ?`, [candidate_id]);
  if (candidates.length === 0) {
    return res.status(400).json({ error: '候选人不存在' });
  }
  const candidate = candidates[0];
  if (candidate.is_blacklisted) {
    return res.status(400).json({ error: '该候选人已在黑名单中，无法安排面试' });
  }
  
  const existing = query(`SELECT * FROM interviews WHERE position_id = ? AND candidate_id = ? AND status IN ('scheduled', 'rescheduled', 'in_progress')`, [position_id, candidate_id]);
  if (existing.length > 0) {
    return res.status(400).json({ error: '同一候选人同一岗位已有进行中的面试安排，无法重复排面' });
  }
  
  const result = run(`INSERT INTO interviews (position_id, candidate_id, hr_name, scheduled_time, notes) VALUES (?, ?, ?, ?, ?)`, 
    [position_id, candidate_id, hr_name, scheduled_time, notes]);
  
  addTimeline(result.lastInsertRowid, candidate_id, '安排面试', `安排时间: ${scheduled_time}`, hr_name);
  
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/interviews/:id/checkin', (req, res) => {
  const { checkin_status, actual_signin_time } = req.body;
  const interviews = query(`SELECT * FROM interviews WHERE id = ?`, [parseInt(req.params.id)]);
  if (interviews.length === 0) return res.status(404).json({ error: '面试记录不存在' });
  const interview = interviews[0];
  
  run(`UPDATE interviews SET checkin_status = ?, actual_signin_time = ?, status = 'completed' WHERE id = ?`, 
    [checkin_status, actual_signin_time, interview.id]);
  
  if (checkin_status === 'no_show') {
    run(`UPDATE candidates SET no_show_count = no_show_count + 1 WHERE id = ?`, [interview.candidate_id]);
    updateCandidateRisk(interview.candidate_id);
    
    const updatedCandidates = query(`SELECT no_show_count FROM candidates WHERE id = ?`, [interview.candidate_id]);
    const updatedCandidate = updatedCandidates[0];
    if (updatedCandidate.no_show_count >= 2) {
      addTimeline(interview.id, interview.candidate_id, '系统提醒', '候选人多次爽约，已进入高风险复核名单', '系统');
    }
    
    addTimeline(interview.id, interview.candidate_id, '爽约', '面试爽约', '系统');
  } else if (checkin_status === 'attended') {
    addTimeline(interview.id, interview.candidate_id, '参加面试', `签到时间: ${actual_signin_time}`, '系统');
  }
  
  res.json({ success: true });
});

app.get('/api/interviews/:id/reschedule-requests', (req, res) => {
  const requests = query(`SELECT * FROM reschedule_requests WHERE interview_id = ? ORDER BY created_at DESC`, [parseInt(req.params.id)]);
  res.json(requests);
});

app.post('/api/interviews/:id/reschedule-requests', (req, res) => {
  const { requested_time, reason } = req.body;
  const interviews = query(`SELECT * FROM interviews WHERE id = ?`, [parseInt(req.params.id)]);
  if (interviews.length === 0) return res.status(404).json({ error: '面试记录不存在' });
  const interview = interviews[0];
  
  const now = new Date();
  const scheduledTime = new Date(interview.scheduled_time);
  if (now >= scheduledTime) {
    return res.status(400).json({ error: '面试已开始，无法申请改期' });
  }
  
  const result = run(`INSERT INTO reschedule_requests (interview_id, original_time, requested_time, reason) VALUES (?, ?, ?, ?)`, 
    [interview.id, interview.scheduled_time, requested_time, reason]);
  
  addTimeline(interview.id, interview.candidate_id, '申请改期', `原时间: ${interview.scheduled_time}, 申请时间: ${requested_time}, 原因: ${reason}`, '候选人');
  
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/reschedule-requests/:id', (req, res) => {
  const { status, reviewer } = req.body;
  const requests = query(`SELECT * FROM reschedule_requests WHERE id = ?`, [parseInt(req.params.id)]);
  if (requests.length === 0) return res.status(404).json({ error: '改期申请不存在' });
  const request = requests[0];
  if (request.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
  
  run(`UPDATE reschedule_requests SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP WHERE id = ?`, 
    [status, reviewer, request.id]);
  
  const interviews = query(`SELECT * FROM interviews WHERE id = ?`, [request.interview_id]);
  const interview = interviews[0];
  
  if (status === 'approved') {
    run(`UPDATE interviews SET scheduled_time = ?, status = 'rescheduled', reschedule_count = reschedule_count + 1 WHERE id = ?`, 
      [request.requested_time, interview.id]);
    addTimeline(interview.id, interview.candidate_id, '改期通过', `新时间: ${request.requested_time}`, reviewer);
  } else {
    addTimeline(interview.id, interview.candidate_id, '改期被拒', `原因: ${req.body.reason || '未说明'}`, reviewer);
  }
  
  res.json({ success: true });
});

app.post('/api/interviews/:id/decisions', (req, res) => {
  const { type, decision, notes, actor } = req.body;
  const interviews = query(`SELECT * FROM interviews WHERE id = ?`, [parseInt(req.params.id)]);
  if (interviews.length === 0) return res.status(404).json({ error: '面试记录不存在' });
  const interview = interviews[0];
  
  const result = run(`INSERT INTO decisions (interview_id, type, decision, notes) VALUES (?, ?, ?, ?)`, 
    [interview.id, type, decision, notes]);
  
  if (type === 'reschedule' && decision === 'rebook') {
    run(`UPDATE interviews SET status = 'scheduled' WHERE id = ?`, [interview.id]);
    addTimeline(interview.id, interview.candidate_id, '复约决定', '已同意复约，重新安排面试', actor);
  } else if (type === 'blacklist' && decision === 'add') {
    run(`UPDATE candidates SET is_blacklisted = 1 WHERE id = ?`, [interview.candidate_id]);
    updateCandidateRisk(interview.candidate_id);
    addTimeline(interview.id, interview.candidate_id, '加入黑名单', `原因: ${notes || '未说明'}`, actor);
  } else if (type === 'followup') {
    addTimeline(interview.id, interview.candidate_id, '待跟进', `备注: ${notes || '未说明'}`, actor);
  }
  
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/interviews/:id/timeline', (req, res) => {
  const timeline = query(`SELECT * FROM timelines WHERE interview_id = ? ORDER BY created_at DESC`, [parseInt(req.params.id)]);
  res.json(timeline);
});

app.get('/api/stats/weekly', (req, res) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  
  const weekStartStr = weekStart.toISOString();
  const weekEndStr = weekEnd.toISOString();
  
  const totalRes = query(`SELECT COUNT(*) as count FROM interviews WHERE scheduled_time >= ? AND scheduled_time < ?`, [weekStartStr, weekEndStr]);
  const total = totalRes[0].count;
  
  const attendedRes = query(`SELECT COUNT(*) as count FROM interviews WHERE scheduled_time >= ? AND scheduled_time < ? AND checkin_status = 'attended'`, [weekStartStr, weekEndStr]);
  const attended = attendedRes[0].count;
  
  const noShowRes = query(`SELECT COUNT(*) as count FROM interviews WHERE scheduled_time >= ? AND scheduled_time < ? AND checkin_status = 'no_show'`, [weekStartStr, weekEndStr]);
  const noShow = noShowRes[0].count;
  
  const completedRes = query(`SELECT COUNT(*) as count FROM interviews WHERE scheduled_time >= ? AND scheduled_time < ? AND status = 'completed'`, [weekStartStr, weekEndStr]);
  const completed = completedRes[0].count;
  
  const followup = query(`
    SELECT i.*, p.name as position_name, c.name as candidate_name, c.phone, c.email
    FROM interviews i
    JOIN positions p ON i.position_id = p.id
    JOIN candidates c ON i.candidate_id = c.id
    WHERE i.checkin_status = 'no_show' AND i.status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM decisions d WHERE d.interview_id = i.id AND d.type IN ('reschedule', 'blacklist'))
    ORDER BY i.scheduled_time DESC
  `);
  
  const highRisk = query(`
    SELECT c.*, COUNT(i.id) as interview_count
    FROM candidates c
    LEFT JOIN interviews i ON c.id = i.candidate_id
    WHERE c.risk_level IN ('high', 'blacklisted')
    GROUP BY c.id
    ORDER BY c.no_show_count DESC
  `);
  
  res.json({
    week_start: weekStartStr,
    week_end: weekEndStr,
    total_interviews: total,
    completed_interviews: completed,
    attended_count: attended,
    no_show_count: noShow,
    completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
    no_show_rate: total > 0 ? ((noShow / total) * 100).toFixed(1) : 0,
    followup_list: followup,
    high_risk_candidates: highRisk
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ 招聘面试爽约追踪台运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
