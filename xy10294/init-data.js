const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Database = require('better-sqlite3');

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
    updated_at TEXT NOT NULL
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

const employees = [
  { employee_id: 'EMP001', name: '张三', department: '组装车间' },
  { employee_id: 'EMP002', name: '李四', department: '组装车间' },
  { employee_id: 'EMP003', name: '王五', department: '测试车间' },
  { employee_id: 'EMP004', name: '赵六', department: '测试车间' },
  { employee_id: 'EMP005', name: '周七', department: '包装车间' },
  { employee_id: 'EMP006', name: '吴八', department: '组装车间' },
];

const skills = [
  { skill_id: 'SK001', skill_name: '焊接操作', skill_code: 'WELD', description: '焊接设备操作与维护' },
  { skill_id: 'SK002', skill_name: '螺丝组装', skill_code: 'ASSEM', description: '螺丝锁紧与组装' },
  { skill_id: 'SK003', skill_name: '电气检测', skill_code: 'ELECT', description: '电气性能测试' },
  { skill_id: 'SK004', skill_name: '外观检验', skill_code: 'VISUAL', description: '产品外观目视检查' },
  { skill_id: 'SK005', skill_name: '包装封箱', skill_code: 'PACK', description: '产品包装与封箱' },
  { skill_id: 'SK006', skill_name: '机器人编程', skill_code: 'ROBOT', description: '工业机器人编程操作' },
];

const positions = [
  { position_id: 'POS001', position_name: '主焊接岗', position_code: 'WELD-MAIN', line_number: 'L1' },
  { position_id: 'POS002', position_name: '辅助焊接岗', position_code: 'WELD-AUX', line_number: 'L1' },
  { position_id: 'POS003', position_name: '螺丝组装岗', position_code: 'ASS-01', line_number: 'L1' },
  { position_id: 'POS004', position_name: '电气检测岗', position_code: 'TEST-E', line_number: 'L2' },
  { position_id: 'POS005', position_name: '外观检验岗', position_code: 'TEST-V', line_number: 'L2' },
  { position_id: 'POS006', position_name: '包装封箱岗', position_code: 'PACK-01', line_number: 'L3' },
  { position_id: 'POS007', position_name: '机器人操作岗', position_code: 'ROBOT-01', line_number: 'L1' },
];

const positionRequirements = [
  { position_id: 'POS001', skill_id: 'SK001', required_level: 3, is_mandatory: 1 },
  { position_id: 'POS001', skill_id: 'SK006', required_level: 2, is_mandatory: 0 },
  { position_id: 'POS002', skill_id: 'SK001', required_level: 2, is_mandatory: 1 },
  { position_id: 'POS003', skill_id: 'SK002', required_level: 2, is_mandatory: 1 },
  { position_id: 'POS004', skill_id: 'SK003', required_level: 3, is_mandatory: 1 },
  { position_id: 'POS005', skill_id: 'SK004', required_level: 2, is_mandatory: 1 },
  { position_id: 'POS006', skill_id: 'SK005', required_level: 1, is_mandatory: 1 },
  { position_id: 'POS007', skill_id: 'SK006', required_level: 3, is_mandatory: 1 },
  { position_id: 'POS007', skill_id: 'SK001', required_level: 1, is_mandatory: 0 },
];

const employeeSkills = [
  { employee_id: 'EMP001', skill_id: 'SK001', skill_level: 4 },
  { employee_id: 'EMP001', skill_id: 'SK002', skill_level: 3 },
  { employee_id: 'EMP001', skill_id: 'SK006', skill_level: 2 },
  { employee_id: 'EMP002', skill_id: 'SK001', skill_level: 3 },
  { employee_id: 'EMP002', skill_id: 'SK002', skill_level: 4 },
  { employee_id: 'EMP003', skill_id: 'SK003', skill_level: 4 },
  { employee_id: 'EMP003', skill_id: 'SK004', skill_level: 3 },
  { employee_id: 'EMP004', skill_id: 'SK003', skill_level: 2 },
  { employee_id: 'EMP004', skill_id: 'SK004', skill_level: 4 },
  { employee_id: 'EMP005', skill_id: 'SK005', skill_level: 3 },
  { employee_id: 'EMP005', skill_id: 'SK004', skill_level: 2 },
  { employee_id: 'EMP006', skill_id: 'SK001', skill_level: 1 },
  { employee_id: 'EMP006', skill_id: 'SK002', skill_level: 2 },
];

const now = new Date().toISOString();
const today = now.split('T')[0];

const getDateDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const attendanceRecords = [
  { employee_id: 'EMP001', record_date: getDateDaysAgo(6), work_hours: 10 },
  { employee_id: 'EMP001', record_date: getDateDaysAgo(5), work_hours: 10 },
  { employee_id: 'EMP001', record_date: getDateDaysAgo(4), work_hours: 10 },
  { employee_id: 'EMP001', record_date: getDateDaysAgo(3), work_hours: 10 },
  { employee_id: 'EMP001', record_date: getDateDaysAgo(2), work_hours: 10 },
  { employee_id: 'EMP001', record_date: getDateDaysAgo(1), work_hours: 10 },
  { employee_id: 'EMP002', record_date: getDateDaysAgo(6), work_hours: 8 },
  { employee_id: 'EMP002', record_date: getDateDaysAgo(5), work_hours: 8 },
  { employee_id: 'EMP002', record_date: getDateDaysAgo(2), work_hours: 8 },
  { employee_id: 'EMP002', record_date: getDateDaysAgo(1), work_hours: 8 },
  { employee_id: 'EMP006', record_date: today, is_absent: 1, absence_reason: '事假' },
];

const insertEmployees = db.prepare(`
  INSERT OR IGNORE INTO employees (employee_id, name, department, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertSkills = db.prepare(`
  INSERT OR IGNORE INTO skills (skill_id, skill_name, skill_code, description, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertPositions = db.prepare(`
  INSERT OR IGNORE INTO positions (position_id, position_name, position_code, line_number, description, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertPositionRequirements = db.prepare(`
  INSERT OR IGNORE INTO position_requirements (requirement_id, position_id, skill_id, required_level, is_mandatory, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertEmployeeSkills = db.prepare(`
  INSERT OR IGNORE INTO employee_skills 
  (certification_id, employee_id, skill_id, skill_level, certified_at, is_valid, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
`);

const insertAttendance = db.prepare(`
  INSERT OR IGNORE INTO attendance_records 
  (record_id, employee_id, record_date, work_hours, is_absent, absence_reason, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  employees.forEach(e => insertEmployees.run(e.employee_id, e.name, e.department, now, now));
  skills.forEach(s => insertSkills.run(s.skill_id, s.skill_name, s.skill_code, s.description, now));
  positions.forEach(p => insertPositions.run(p.position_id, p.position_name, p.position_code, p.line_number, null, now));
  positionRequirements.forEach(pr => insertPositionRequirements.run(uuidv4(), pr.position_id, pr.skill_id, pr.required_level, pr.is_mandatory, now));
  employeeSkills.forEach(es => insertEmployeeSkills.run(uuidv4(), es.employee_id, es.skill_id, es.skill_level, now, now, now));
  attendanceRecords.forEach(ar => insertAttendance.run(
    uuidv4(), 
    ar.employee_id, 
    ar.record_date, 
    ar.work_hours || 0, 
    ar.is_absent ? 1 : 0, 
    ar.absence_reason || null, 
    now, 
    now
  ));
});

tx();

console.log('测试数据初始化完成！');
console.log('员工:', employees.length, '人');
console.log('技能:', skills.length, '项');
console.log('岗位:', positions.length, '个');
console.log('岗位技能要求:', positionRequirements.length, '条');
console.log('员工技能认证:', employeeSkills.length, '条');
console.log('考勤记录:', attendanceRecords.length, '条');
console.log('');
console.log('关键数据说明:');
console.log('- EMP001(张三): 连续工作6天，7天累计60小时 -> 疲劳状态');
console.log('- EMP006(吴八): 今日已标记事假 -> 缺勤');
console.log('- POS001(主焊接岗): 要求焊接L3 + 机器人L2(非必须)');
console.log('- EMP001 焊接L4 + 机器人L2 -> 可胜任主焊接岗');
console.log('- EMP002 焊接L3 + 无机器人技能 -> 机器人技能非必须，也可胜任');
console.log('- EMP006 焊接L1 -> 等级不足，无法胜任主焊接岗');
