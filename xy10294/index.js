const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'production_line.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    employee_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills (
    skill_id TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL,
    skill_code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employee_skills (
    certification_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_level INTEGER NOT NULL DEFAULT 1,
    certified_at TEXT NOT NULL,
    expires_at TEXT,
    is_valid INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id),
    UNIQUE(employee_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS positions (
    position_id TEXT PRIMARY KEY,
    position_name TEXT NOT NULL,
    position_code TEXT NOT NULL UNIQUE,
    line_number TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS position_requirements (
    requirement_id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    required_level INTEGER NOT NULL DEFAULT 1,
    is_mandatory INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (position_id) REFERENCES positions(position_id),
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id),
    UNIQUE(position_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    record_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    record_date TEXT NOT NULL,
    work_start_time TEXT,
    work_end_time TEXT,
    is_absent INTEGER NOT NULL DEFAULT 0,
    absence_reason TEXT,
    work_hours REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id, record_date)
  );

  CREATE TABLE IF NOT EXISTS fatigue_records (
    fatigue_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    record_date TEXT NOT NULL,
    consecutive_work_days INTEGER NOT NULL DEFAULT 0,
    accumulated_hours REAL NOT NULL DEFAULT 0,
    is_fatigued INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id, record_date)
  );

  CREATE TABLE IF NOT EXISTS shift_requests (
    request_id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    requester_id TEXT NOT NULL,
    original_position_id TEXT,
    target_position_id TEXT NOT NULL,
    original_employee_id TEXT,
    replacement_employee_id TEXT,
    shift_date TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (original_position_id) REFERENCES positions(position_id),
    FOREIGN KEY (target_position_id) REFERENCES positions(position_id),
    FOREIGN KEY (original_employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (replacement_employee_id) REFERENCES employees(employee_id)
  );

  CREATE TABLE IF NOT EXISTS request_transitions (
    transition_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    transition_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES shift_requests(request_id)
  );

  CREATE TABLE IF NOT EXISTS request_validations (
    validation_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    validation_type TEXT NOT NULL,
    is_passed INTEGER NOT NULL,
    message TEXT,
    details TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES shift_requests(request_id)
  );
`);

const getNow = () => new Date().toISOString();
const toIsoDate = (date) => {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
};

const FATIGUE_CONFIG = {
  maxConsecutiveDays: 6,
  maxAccumulatedHours: 48,
  dailyMaxHours: 12,
};

const STATUS_FLOW = {
  DRAFT: ['PENDING_APPROVAL', 'WITHDRAWN'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['COMPLETED', 'WITHDRAWN'],
  REJECTED: ['DRAFT'],
  WITHDRAWN: [],
  COMPLETED: [],
};

const runWithErrorHandling = (fn, res) => {
  try {
    return fn();
  } catch (err) {
    console.error('Error:', err);
    const isDbUnique = err.code === 'SQLITE_CONSTRAINT_UNIQUE';
    return res.status(isDbUnique ? 409 : 400).json({
      success: false,
      error: isDbUnique ? 'DUPLICATE_DATA' : 'BAD_REQUEST',
      message: err.message,
    });
  }
};

const validateRequiredFields = (data, fields) => {
  const missing = fields.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
  if (missing.length > 0) {
    const err = new Error(`缺少必填字段: ${missing.join(', ')}`);
    err.code = 'MISSING_FIELDS';
    throw err;
  }
};

const checkIdempotency = (table, keyField, idempotencyKey) => {
  const row = db.prepare(`SELECT * FROM ${table} WHERE ${keyField} = ?`).get(idempotencyKey);
  return row;
};

const saveIdempotencyResponse = (table, keyField, key, response) => {
  return response;
};

app.post('/api/employees', (req, res) => runWithErrorHandling(() => {
  const { employee_id, name, department, idempotency_key } = req.body;
  validateRequiredFields(req.body, ['name', 'department']);
  const finalId = employee_id || uuidv4();
  if (idempotency_key) {
    const existing = db.prepare('SELECT * FROM employee_skills WHERE idempotency_key = ?').get(idempotency_key);
    if (existing) {
      const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(existing.employee_id);
      if (emp) return res.status(200).json({ success: true, data: emp, from_cache: true });
    }
  }
  const existing = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(finalId);
  if (existing) return res.status(200).json({ success: true, data: existing, from_cache: true });
  const now = getNow();
  db.prepare(`INSERT INTO employees (employee_id, name, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(finalId, name, department, now, now);
  const created = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(finalId);
  res.status(201).json({ success: true, data: created });
}, res));

app.get('/api/employees', (req, res) => runWithErrorHandling(() => {
  const { department } = req.query;
  let sql = 'SELECT * FROM employees WHERE 1=1';
  const params = [];
  if (department) { sql += ' AND department = ?'; params.push(department); }
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
}, res));

app.post('/api/skills', (req, res) => runWithErrorHandling(() => {
  const { skill_id, skill_name, skill_code, description } = req.body;
  validateRequiredFields(req.body, ['skill_name', 'skill_code']);
  const finalId = skill_id || uuidv4();
  const now = getNow();
  db.prepare(`INSERT INTO skills (skill_id, skill_name, skill_code, description, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(finalId, skill_name, skill_code, description, now);
  const created = db.prepare('SELECT * FROM skills WHERE skill_id = ?').get(finalId);
  res.status(201).json({ success: true, data: created });
}, res));

app.get('/api/skills', (req, res) => runWithErrorHandling(() => {
  const rows = db.prepare('SELECT * FROM skills').all();
  res.json({ success: true, data: rows });
}, res));

app.post('/api/employee-skills', (req, res) => runWithErrorHandling(() => {
  const { certification_id, employee_id, skill_id, skill_level, certified_at, expires_at, idempotency_key } = req.body;
  validateRequiredFields(req.body, ['employee_id', 'skill_id']);
  const finalCertId = certification_id || uuidv4();
  const now = getNow();
  const certTime = certified_at || now;
  if (idempotency_key) {
    const existing = db.prepare('SELECT * FROM employee_skills WHERE idempotency_key = ?').get(idempotency_key);
    if (existing) return res.status(200).json({ success: true, data: existing, from_cache: true });
  }
  const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id);
  if (!emp) throw new Error(`员工不存在: ${employee_id}`);
  const skill = db.prepare('SELECT * FROM skills WHERE skill_id = ?').get(skill_id);
  if (!skill) throw new Error(`技能不存在: ${skill_id}`);
  const level = skill_level || 1;
  if (level < 1 || level > 5) throw new Error('技能等级必须在 1-5 之间');
  db.prepare(`
    INSERT INTO employee_skills 
    (certification_id, employee_id, skill_id, skill_level, certified_at, expires_at, is_valid, created_at, updated_at, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(finalCertId, employee_id, skill_id, level, certTime, expires_at || null, now, now, idempotency_key || null);
  const created = db.prepare('SELECT * FROM employee_skills WHERE certification_id = ?').get(finalCertId);
  res.status(201).json({ success: true, data: created });
}, res));

app.get('/api/employee-skills', (req, res) => runWithErrorHandling(() => {
  const { employee_id } = req.query;
  let sql = `SELECT es.*, e.name as employee_name, s.skill_name, s.skill_code 
             FROM employee_skills es 
             JOIN employees e ON es.employee_id = e.employee_id 
             JOIN skills s ON es.skill_id = s.skill_id WHERE 1=1`;
  const params = [];
  if (employee_id) { sql += ' AND es.employee_id = ?'; params.push(employee_id); }
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
}, res));

app.post('/api/positions', (req, res) => runWithErrorHandling(() => {
  const { position_id, position_name, position_code, line_number, description } = req.body;
  validateRequiredFields(req.body, ['position_name', 'position_code', 'line_number']);
  const finalId = position_id || uuidv4();
  const now = getNow();
  db.prepare(`INSERT INTO positions (position_id, position_name, position_code, line_number, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(finalId, position_name, position_code, line_number, description, now);
  const created = db.prepare('SELECT * FROM positions WHERE position_id = ?').get(finalId);
  res.status(201).json({ success: true, data: created });
}, res));

app.get('/api/positions', (req, res) => runWithErrorHandling(() => {
  const { line_number } = req.query;
  let sql = 'SELECT * FROM positions WHERE 1=1';
  const params = [];
  if (line_number) { sql += ' AND line_number = ?'; params.push(line_number); }
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
}, res));

app.post('/api/position-requirements', (req, res) => runWithErrorHandling(() => {
  const { requirement_id, position_id, skill_id, required_level, is_mandatory } = req.body;
  validateRequiredFields(req.body, ['position_id', 'skill_id']);
  const finalId = requirement_id || uuidv4();
  const now = getNow();
  const level = required_level || 1;
  if (level < 1 || level > 5) throw new Error('要求等级必须在 1-5 之间');
  const mandatory = is_mandatory === false ? 0 : 1;
  db.prepare(`
    INSERT INTO position_requirements (requirement_id, position_id, skill_id, required_level, is_mandatory, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(finalId, position_id, skill_id, level, mandatory, now);
  const created = db.prepare('SELECT * FROM position_requirements WHERE requirement_id = ?').get(finalId);
  res.status(201).json({ success: true, data: created });
}, res));

app.get('/api/position-requirements', (req, res) => runWithErrorHandling(() => {
  const { position_id } = req.query;
  let sql = `SELECT pr.*, p.position_name, p.position_code, s.skill_name, s.skill_code 
             FROM position_requirements pr 
             JOIN positions p ON pr.position_id = p.position_id 
             JOIN skills s ON pr.skill_id = s.skill_id WHERE 1=1`;
  const params = [];
  if (position_id) { sql += ' AND pr.position_id = ?'; params.push(position_id); }
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
}, res));

app.post('/api/attendance', (req, res) => runWithErrorHandling(() => {
  const { record_id, employee_id, record_date, work_start_time, work_end_time, is_absent, absence_reason, work_hours } = req.body;
  validateRequiredFields(req.body, ['employee_id', 'record_date']);
  const finalId = record_id || uuidv4();
  const now = getNow();
  const date = toIsoDate(record_date);
  const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id);
  if (!emp) throw new Error(`员工不存在: ${employee_id}`);
  let hours = work_hours;
  if (hours === undefined && work_start_time && work_end_time) {
    const start = new Date(work_start_time);
    const end = new Date(work_end_time);
    hours = (end - start) / (1000 * 60 * 60);
  }
  const absent = is_absent ? 1 : 0;
  const finalHours = absent ? 0 : (hours || 0);
  if (finalHours > FATIGUE_CONFIG.dailyMaxHours) {
    throw new Error(`单日工时不能超过 ${FATIGUE_CONFIG.dailyMaxHours} 小时`);
  }
  const existing = db.prepare('SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?').get(employee_id, date);
  if (existing) {
    db.prepare(`
      UPDATE attendance_records SET work_start_time=?, work_end_time=?, is_absent=?, absence_reason=?, work_hours=?, updated_at=?
      WHERE employee_id = ? AND record_date = ?
    `).run(work_start_time || null, work_end_time || null, absent, absence_reason || null, finalHours, now, employee_id, date);
    const updated = db.prepare('SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?').get(employee_id, date);
    updateFatigueRecord(employee_id, date);
    return res.status(200).json({ success: true, data: updated });
  }
  db.prepare(`
    INSERT INTO attendance_records 
    (record_id, employee_id, record_date, work_start_time, work_end_time, is_absent, absence_reason, work_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(finalId, employee_id, date, work_start_time || null, work_end_time || null, absent, absence_reason || null, finalHours, now, now);
  updateFatigueRecord(employee_id, date);
  const created = db.prepare('SELECT * FROM attendance_records WHERE record_id = ?').get(finalId);
  res.status(201).json({ success: true, data: created });
}, res));

const updateFatigueRecord = (employee_id, recordDate) => {
  const now = getNow();
  const date = toIsoDate(recordDate);
  const records = db.prepare(`
    SELECT record_date, work_hours, is_absent FROM attendance_records 
    WHERE employee_id = ? AND record_date <= ? ORDER BY record_date DESC LIMIT 14
  `).all(employee_id, date);
  let consecutiveDays = 0;
  let accumulatedHours = 0;
  const sevenDaysAgo = new Date(date);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = toIsoDate(sevenDaysAgo);
  for (const record of records) {
    if (record.record_date >= sevenDaysAgoStr) {
      if (!record.is_absent) {
        accumulatedHours += record.work_hours;
        if (consecutiveDays === 0 || record.record_date === date) {
          consecutiveDays++;
        }
      } else {
        consecutiveDays = 0;
      }
    }
  }
  const isFatigued = (consecutiveDays >= FATIGUE_CONFIG.maxConsecutiveDays) || 
                      (accumulatedHours >= FATIGUE_CONFIG.maxAccumulatedHours) ? 1 : 0;
  const existing = db.prepare('SELECT * FROM fatigue_records WHERE employee_id = ? AND record_date = ?').get(employee_id, date);
  if (existing) {
    db.prepare(`
      UPDATE fatigue_records SET consecutive_work_days=?, accumulated_hours=?, is_fatigued=?, updated_at=?
      WHERE employee_id = ? AND record_date = ?
    `).run(consecutiveDays, accumulatedHours, isFatigued, now, employee_id, date);
  } else {
    db.prepare(`
      INSERT INTO fatigue_records (fatigue_id, employee_id, record_date, consecutive_work_days, accumulated_hours, is_fatigued, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), employee_id, date, consecutiveDays, accumulatedHours, isFatigued, now, now);
  }
};

app.get('/api/fatigue/:employee_id', (req, res) => runWithErrorHandling(() => {
  const { employee_id } = req.params;
  const { date } = req.query;
  const targetDate = date ? toIsoDate(date) : toIsoDate(new Date());
  let record = db.prepare('SELECT * FROM fatigue_records WHERE employee_id = ? AND record_date = ?').get(employee_id, targetDate);
  if (!record) {
    record = {
      employee_id,
      record_date: targetDate,
      consecutive_work_days: 0,
      accumulated_hours: 0,
      is_fatigued: 0,
    };
  }
  const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employee_id);
  res.json({
    success: true,
    data: {
      ...record,
      employee_name: emp ? emp.name : null,
      config: FATIGUE_CONFIG,
      warnings: [
        record.consecutive_work_days >= FATIGUE_CONFIG.maxConsecutiveDays 
          ? `连续工作 ${record.consecutive_work_days} 天，超过限制 ${FATIGUE_CONFIG.maxConsecutiveDays} 天` 
          : null,
        record.accumulated_hours >= FATIGUE_CONFIG.maxAccumulatedHours
          ? `7天内累计 ${record.accumulated_hours} 小时，超过限制 ${FATIGUE_CONFIG.maxAccumulatedHours} 小时`
          : null,
      ].filter(Boolean),
    },
  });
}, res));

const validateSkillMatch = (employee_id, position_id) => {
  const requirements = db.prepare(`
    SELECT pr.*, s.skill_name, s.skill_code 
    FROM position_requirements pr 
    JOIN skills s ON pr.skill_id = s.skill_id 
    WHERE pr.position_id = ?
  `).all(position_id);
  if (requirements.length === 0) {
    return { passed: true, details: [{ message: '该岗位无技能要求，直接通过' }] };
  }
  const employeeSkills = db.prepare(`
    SELECT es.skill_id, es.skill_level, es.is_valid, s.skill_name, s.skill_code
    FROM employee_skills es 
    JOIN skills s ON es.skill_id = s.skill_id 
    WHERE es.employee_id = ? AND es.is_valid = 1
  `).all(employee_id);
  const skillMap = new Map();
  for (const skill of employeeSkills) {
    skillMap.set(skill.skill_id, skill);
  }
  const details = [];
  let allPassed = true;
  for (const req of requirements) {
    const empSkill = skillMap.get(req.skill_id);
    const detail = {
      skill_id: req.skill_id,
      skill_name: req.skill_name,
      skill_code: req.skill_code,
      required_level: req.required_level,
      is_mandatory: req.is_mandatory === 1,
    };
    if (!empSkill) {
      detail.employee_level = null;
      detail.passed = !req.is_mandatory;
      detail.message = req.is_mandatory 
        ? `缺少必要技能: ${req.skill_name}` 
        : `缺少非必要技能: ${req.skill_name}，但岗位允许`;
      if (req.is_mandatory) allPassed = false;
    } else if (empSkill.skill_level < req.required_level) {
      detail.employee_level = empSkill.skill_level;
      detail.passed = !req.is_mandatory;
      detail.message = req.is_mandatory
        ? `技能等级不足: ${req.skill_name} 要求 L${req.required_level}，员工 L${empSkill.skill_level}`
        : `非必要技能等级不足: ${req.skill_name}`;
      if (req.is_mandatory) allPassed = false;
    } else {
      detail.employee_level = empSkill.skill_level;
      detail.passed = true;
      detail.message = `技能匹配: ${req.skill_name} L${empSkill.skill_level} >= L${req.required_level}`;
    }
    details.push(detail);
  }
  return { passed: allPassed, details };
};

const validateFatigue = (employee_id, shift_date) => {
  const date = toIsoDate(shift_date);
  let record = db.prepare('SELECT * FROM fatigue_records WHERE employee_id = ? AND record_date = ?').get(employee_id, date);
  if (!record) {
    record = { consecutive_work_days: 0, accumulated_hours: 0, is_fatigued: 0 };
  }
  const details = {
    consecutive_work_days: record.consecutive_work_days,
    accumulated_hours: record.accumulated_hours,
    max_consecutive_days: FATIGUE_CONFIG.maxConsecutiveDays,
    max_accumulated_hours: FATIGUE_CONFIG.maxAccumulatedHours,
  };
  const isFatigued = record.is_fatigued === 1;
  return {
    passed: !isFatigued,
    details,
    message: isFatigued 
      ? `员工处于疲劳状态: 连续${record.consecutive_work_days}天/7天累计${record.accumulated_hours}小时` 
      : '员工未处于疲劳状态',
  };
};

const validateAbsence = (employee_id, shift_date) => {
  const date = toIsoDate(shift_date);
  const record = db.prepare('SELECT * FROM attendance_records WHERE employee_id = ? AND record_date = ?').get(employee_id, date);
  const isAbsent = record && record.is_absent === 1;
  return {
    passed: !isAbsent,
    details: {
      is_absent: isAbsent,
      absence_reason: record ? record.absence_reason : null,
      shift_date: date,
    },
    message: isAbsent 
      ? `员工 ${date} 已标记缺勤: ${record.absence_reason || '未填写原因'}` 
      : `员工 ${date} 未缺勤`,
  };
};

const validateShiftRequest = (request) => {
  const results = [];
  let overallPassed = true;
  if (request.replacement_employee_id) {
    const skillResult = validateSkillMatch(request.replacement_employee_id, request.target_position_id);
    results.push({
      validation_type: 'SKILL_MATCH',
      is_passed: skillResult.passed ? 1 : 0,
      message: skillResult.passed ? '技能匹配通过' : '技能匹配失败',
      details: JSON.stringify(skillResult.details),
    });
    if (!skillResult.passed) overallPassed = false;
    const fatigueResult = validateFatigue(request.replacement_employee_id, request.shift_date);
    results.push({
      validation_type: 'FATIGUE_CHECK',
      is_passed: fatigueResult.passed ? 1 : 0,
      message: fatigueResult.message,
      details: JSON.stringify(fatigueResult.details),
    });
    if (!fatigueResult.passed) overallPassed = false;
    const absenceResult = validateAbsence(request.replacement_employee_id, request.shift_date);
    results.push({
      validation_type: 'ABSENCE_CHECK',
      is_passed: absenceResult.passed ? 1 : 0,
      message: absenceResult.message,
      details: JSON.stringify(absenceResult.details),
    });
    if (!absenceResult.passed) overallPassed = false;
  } else {
    results.push({
      validation_type: 'NO_REPLACEMENT',
      is_passed: 1,
      message: '未指定替班人员，仅保存申请信息',
      details: '{}',
    });
  }
  results.push({
    validation_type: 'OVERALL',
    is_passed: overallPassed ? 1 : 0,
    message: overallPassed ? '所有校验通过' : '存在校验失败项',
    details: '{}',
  });
  return { passed: overallPassed, validations: results };
};

const saveValidations = (request_id, validations) => {
  const stmt = db.prepare(`
    INSERT INTO request_validations (validation_id, request_id, validation_type, is_passed, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const v of validations) {
    stmt.run(uuidv4(), request_id, v.validation_type, v.is_passed, v.message, v.details, getNow());
  }
};

const createTransition = (request_id, from_status, to_status, transition_type, actor_id, comment) => {
  const fromStatus = from_status || 'NONE';
  const skipCheckTypes = ['REVISE', 'CREATE'];
  if (to_status && from_status && STATUS_FLOW[from_status] && !skipCheckTypes.includes(transition_type) && !STATUS_FLOW[from_status].includes(to_status)) {
    throw new Error(`不允许的状态流转: ${from_status} -> ${to_status}`);
  }
  db.prepare(`
    INSERT INTO request_transitions (transition_id, request_id, from_status, to_status, transition_type, actor_id, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), request_id, fromStatus, to_status, transition_type, actor_id, comment || null, getNow());
};

app.post('/api/shift-requests', (req, res) => runWithErrorHandling(() => {
  const {
    request_id,
    idempotency_key,
    requester_id,
    original_position_id,
    target_position_id,
    original_employee_id,
    replacement_employee_id,
    shift_date,
    shift_type,
    reason,
  } = req.body;
  validateRequiredFields(req.body, ['requester_id', 'target_position_id', 'shift_date', 'shift_type']);
  if (idempotency_key) {
    const existing = db.prepare('SELECT * FROM shift_requests WHERE idempotency_key = ?').get(idempotency_key);
    if (existing) {
      return res.status(200).json({ success: true, data: existing, from_cache: true });
    }
  }
  const finalId = request_id || uuidv4();
  const now = getNow();
  const request = {
    request_id: finalId,
    requester_id,
    original_position_id: original_position_id || null,
    target_position_id,
    original_employee_id: original_employee_id || null,
    replacement_employee_id: replacement_employee_id || null,
    shift_date: toIsoDate(shift_date),
    shift_type,
    reason: reason || null,
    status: 'DRAFT',
  };
  const validationResult = validateShiftRequest(request);
  db.prepare(`
    INSERT INTO shift_requests 
    (request_id, idempotency_key, requester_id, original_position_id, target_position_id, original_employee_id, replacement_employee_id, shift_date, shift_type, reason, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
  `).run(
    finalId,
    idempotency_key || null,
    requester_id,
    original_position_id || null,
    target_position_id,
    original_employee_id || null,
    replacement_employee_id || null,
    request.shift_date,
    shift_type,
    reason || null,
    now,
    now,
  );
  saveValidations(finalId, validationResult.validations);
  createTransition(finalId, null, 'DRAFT', 'CREATE', requester_id, '创建换班申请');
  const created = db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(finalId);
  res.status(201).json({
    success: true,
    data: created,
    validation_summary: {
      passed: validationResult.passed,
      validations: validationResult.validations.map(v => ({
        type: v.validation_type,
        passed: v.is_passed === 1,
        message: v.message,
      })),
    },
  });
}, res));

app.get('/api/shift-requests', (req, res) => runWithErrorHandling(() => {
  const { status, requester_id, shift_date } = req.query;
  let sql = 'SELECT * FROM shift_requests WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (requester_id) { sql += ' AND requester_id = ?'; params.push(requester_id); }
  if (shift_date) { sql += ' AND shift_date = ?'; params.push(toIsoDate(shift_date)); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
}, res));

app.get('/api/shift-requests/:request_id', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const request = db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(request_id);
  if (!request) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '申请不存在' });
  const validations = db.prepare('SELECT * FROM request_validations WHERE request_id = ? ORDER BY created_at').all(request_id);
  const transitions = db.prepare('SELECT * FROM request_transitions WHERE request_id = ? ORDER BY created_at').all(request_id);
  res.json({ success: true, data: { ...request, validations, transitions } });
}, res));

const updateRequestStatus = (request_id, new_status, actor_id, transition_type, comment) => {
  const request = db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(request_id);
  if (!request) throw new Error('申请不存在');
  if (!STATUS_FLOW[request.status].includes(new_status)) {
    throw new Error(`不允许的状态流转: ${request.status} -> ${new_status}`);
  }
  const now = getNow();
  db.prepare('UPDATE shift_requests SET status = ?, updated_at = ? WHERE request_id = ?').run(new_status, now, request_id);
  createTransition(request_id, request.status, new_status, transition_type, actor_id, comment);
  if (new_status === 'PENDING_APPROVAL') {
    const validationResult = validateShiftRequest(request);
    db.prepare('DELETE FROM request_validations WHERE request_id = ?').run(request_id);
    saveValidations(request_id, validationResult.validations);
  }
  return db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(request_id);
};

app.post('/api/shift-requests/:request_id/submit', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const { actor_id, comment } = req.body;
  if (!actor_id) throw new Error('缺少 actor_id');
  const updated = updateRequestStatus(request_id, 'PENDING_APPROVAL', actor_id, 'SUBMIT', comment);
  const validations = db.prepare('SELECT * FROM request_validations WHERE request_id = ? ORDER BY created_at').all(request_id);
  res.json({
    success: true,
    data: updated,
    validation_summary: {
      validations: validations.map(v => ({
        type: v.validation_type,
        passed: v.is_passed === 1,
        message: v.message,
      })),
    },
  });
}, res));

app.post('/api/shift-requests/:request_id/approve', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const { actor_id, comment } = req.body;
  if (!actor_id) throw new Error('缺少 actor_id');
  const validations = db.prepare('SELECT * FROM request_validations WHERE request_id = ? AND validation_type = ?').get(request_id, 'OVERALL');
  if (validations && validations.is_passed !== 1) {
    throw new Error('存在校验失败项，无法审批通过。请先修正问题。');
  }
  const updated = updateRequestStatus(request_id, 'APPROVED', actor_id, 'APPROVE', comment);
  res.json({ success: true, data: updated });
}, res));

app.post('/api/shift-requests/:request_id/reject', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const { actor_id, comment } = req.body;
  if (!actor_id) throw new Error('缺少 actor_id');
  const updated = updateRequestStatus(request_id, 'REJECTED', actor_id, 'REJECT', comment);
  res.json({ success: true, data: updated });
}, res));

app.post('/api/shift-requests/:request_id/withdraw', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const { actor_id, comment } = req.body;
  if (!actor_id) throw new Error('缺少 actor_id');
  const updated = updateRequestStatus(request_id, 'WITHDRAWN', actor_id, 'WITHDRAW', comment);
  res.json({ success: true, data: updated });
}, res));

app.post('/api/shift-requests/:request_id/revise', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const { actor_id, replacement_employee_id, reason, comment } = req.body;
  if (!actor_id) throw new Error('缺少 actor_id');
  const existing = db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(request_id);
  if (!existing) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: '申请不存在' });
  const now = getNow();
  const newRequest = { ...existing };
  if (replacement_employee_id !== undefined) newRequest.replacement_employee_id = replacement_employee_id;
  if (reason !== undefined) newRequest.reason = reason;
  db.prepare(`
    UPDATE shift_requests SET replacement_employee_id=?, reason=?, status='DRAFT', updated_at=?
    WHERE request_id = ?
  `).run(newRequest.replacement_employee_id, newRequest.reason, now, request_id);
  const validationResult = validateShiftRequest(newRequest);
  db.prepare('DELETE FROM request_validations WHERE request_id = ?').run(request_id);
  saveValidations(request_id, validationResult.validations);
  createTransition(request_id, existing.status, 'DRAFT', 'REVISE', actor_id, comment || '修正换班申请');
  const updated = db.prepare('SELECT * FROM shift_requests WHERE request_id = ?').get(request_id);
  res.json({
    success: true,
    data: updated,
    validation_summary: {
      passed: validationResult.passed,
      validations: validationResult.validations.map(v => ({
        type: v.validation_type,
        passed: v.is_passed === 1,
        message: v.message,
      })),
    },
  });
}, res));

app.get('/api/shift-requests/:request_id/validations', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const validations = db.prepare('SELECT * FROM request_validations WHERE request_id = ? ORDER BY created_at').all(request_id);
  res.json({ success: true, data: validations });
}, res));

app.get('/api/shift-requests/:request_id/transitions', (req, res) => runWithErrorHandling(() => {
  const { request_id } = req.params;
  const transitions = db.prepare('SELECT * FROM request_transitions WHERE request_id = ? ORDER BY created_at').all(request_id);
  res.json({ success: true, data: transitions });
}, res));

app.get('/api/summary/matrix', (req, res) => runWithErrorHandling(() => {
  const employees = db.prepare('SELECT * FROM employees').all();
  const skills = db.prepare('SELECT * FROM skills').all();
  const positions = db.prepare('SELECT * FROM positions').all();
  const skillMap = new Map(skills.map(s => [s.skill_id, s]));
  const empSkills = db.prepare('SELECT * FROM employee_skills WHERE is_valid = 1').all();
  const empSkillMap = new Map();
  for (const es of empSkills) {
    if (!empSkillMap.has(es.employee_id)) empSkillMap.set(es.employee_id, new Map());
    empSkillMap.get(es.employee_id).set(es.skill_id, es);
  }
  const posReq = db.prepare('SELECT * FROM position_requirements').all();
  const posReqMap = new Map();
  for (const pr of posReq) {
    if (!posReqMap.has(pr.position_id)) posReqMap.set(pr.position_id, []);
    posReqMap.get(pr.position_id).push(pr);
  }
  const employee_matrix = employees.map(emp => ({
    employee_id: emp.employee_id,
    name: emp.name,
    department: emp.department,
    skills: skills.map(skill => {
      const es = empSkillMap.get(emp.employee_id)?.get(skill.skill_id);
      return {
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        skill_code: skill.skill_code,
        has_skill: !!es,
        level: es ? es.skill_level : null,
        certified_at: es ? es.certified_at : null,
      };
    }),
  }));
  const position_matrix = positions.map(pos => {
    const reqs = posReqMap.get(pos.position_id) || [];
    return {
      position_id: pos.position_id,
      position_name: pos.position_name,
      position_code: pos.position_code,
      line_number: pos.line_number,
      requirements: reqs.map(pr => ({
        skill_id: pr.skill_id,
        skill_name: skillMap.get(pr.skill_id)?.skill_name,
        skill_code: skillMap.get(pr.skill_id)?.skill_code,
        required_level: pr.required_level,
        is_mandatory: pr.is_mandatory === 1,
      })),
    };
  });
  const pending_requests = db.prepare("SELECT * FROM shift_requests WHERE status IN ('DRAFT', 'PENDING_APPROVAL') ORDER BY created_at DESC").all();
  res.json({
    success: true,
    data: {
      employees: employee_matrix,
      positions: position_matrix,
      pending_requests_count: pending_requests.length,
      pending_requests,
      total_employees: employees.length,
      total_skills: skills.length,
      total_positions: positions.length,
    },
  });
}, res));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: getNow() });
});

app.listen(PORT, () => {
  console.log(`产线班组技能矩阵 API 已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
