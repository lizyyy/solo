const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'garden.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      inspection_no TEXT UNIQUE,
      plant_area TEXT NOT NULL,
      plant_area_before TEXT,
      pest_level TEXT NOT NULL,
      pest_level_before TEXT,
      missed_inspection_points INTEGER DEFAULT 0,
      missed_inspection_points_before INTEGER,
      status TEXT DEFAULT 'pending',
      responsible_person TEXT NOT NULL,
      outsourced_score INTEGER,
      seedling_acceptance_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      operation_id TEXT UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_timeline (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      status_from TEXT,
      status_to TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      change_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES inspections (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS field_history (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES inspections (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const sampleInspections = [
    {
      id: 'ins-001',
      inspection_no: 'INSP-2024-001',
      plant_area: 'A区-乔木林',
      plant_area_before: null,
      pest_level: '轻度',
      pest_level_before: null,
      missed_inspection_points: 2,
      missed_inspection_points_before: null,
      status: 'completed',
      responsible_person: '张三',
      outsourced_score: 85,
      seedling_acceptance_status: 'pass',
      operation_id: 'op-001'
    },
    {
      id: 'ins-002',
      inspection_no: 'INSP-2024-002',
      plant_area: 'B区-灌木丛',
      plant_area_before: null,
      pest_level: '中度',
      pest_level_before: null,
      missed_inspection_points: 5,
      missed_inspection_points_before: null,
      status: 'processing',
      responsible_person: '李四',
      outsourced_score: 72,
      seedling_acceptance_status: 'pending',
      operation_id: 'op-002'
    },
    {
      id: 'ins-003',
      inspection_no: 'INSP-2024-003',
      plant_area: 'C区-草坪区',
      plant_area_before: 'C区-花坛',
      pest_level: '重度',
      pest_level_before: '中度',
      missed_inspection_points: 0,
      missed_inspection_points_before: 3,
      status: 'pending_review',
      responsible_person: '王五',
      outsourced_score: 68,
      seedling_acceptance_status: 'failed',
      operation_id: 'op-003'
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO inspections 
    (id, inspection_no, plant_area, plant_area_before, pest_level, pest_level_before, 
     missed_inspection_points, missed_inspection_points_before, status, responsible_person, 
     outsourced_score, seedling_acceptance_status, operation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleInspections.forEach(ins => {
    stmt.run(
      ins.id, ins.inspection_no, ins.plant_area, ins.plant_area_before,
      ins.pest_level, ins.pest_level_before, ins.missed_inspection_points,
      ins.missed_inspection_points_before, ins.status, ins.responsible_person,
      ins.outsourced_score, ins.seedling_acceptance_status, ins.operation_id
    );
  });
  stmt.finalize();

  const sampleTimeline = [
    {
      id: 'tl-001',
      inspection_id: 'ins-001',
      status_from: 'pending',
      status_to: 'processing',
      changed_by: '张三',
      change_reason: '开始巡检',
      change_details: '巡检人员已到达现场'
    },
    {
      id: 'tl-002',
      inspection_id: 'ins-001',
      status_from: 'processing',
      status_to: 'pending_review',
      changed_by: '张三',
      change_reason: '提交巡检结果',
      change_details: '发现轻度病虫害，扣2分'
    },
    {
      id: 'tl-003',
      inspection_id: 'ins-001',
      status_from: 'pending_review',
      status_to: 'completed',
      changed_by: '管理员',
      change_reason: '审核通过',
      change_details: '补苗验收通过，外包评分85分'
    },
    {
      id: 'tl-004',
      inspection_id: 'ins-002',
      status_from: 'pending',
      status_to: 'processing',
      changed_by: '李四',
      change_reason: '开始巡检',
      change_details: '中度病虫害需要处理'
    },
    {
      id: 'tl-005',
      inspection_id: 'ins-003',
      status_from: 'pending',
      status_to: 'processing',
      changed_by: '王五',
      change_reason: '开始巡检',
      change_details: '区域从花坛调整为草坪区'
    },
    {
      id: 'tl-006',
      inspection_id: 'ins-003',
      status_from: 'processing',
      status_to: 'pending_review',
      changed_by: '王五',
      change_reason: '补苗验收异常',
      change_details: '重度病虫害，需人工复核'
    }
  ];

  const tlStmt = db.prepare(`
    INSERT OR IGNORE INTO status_timeline 
    (id, inspection_id, status_from, status_to, changed_by, change_reason, change_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  sampleTimeline.forEach(tl => {
    tlStmt.run(tl.id, tl.inspection_id, tl.status_from, tl.status_to, 
               tl.changed_by, tl.change_reason, tl.change_details);
  });
  tlStmt.finalize();

  const sampleFieldHistory = [
    {
      id: 'fh-001',
      inspection_id: 'ins-003',
      field_name: 'plant_area',
      old_value: 'C区-花坛',
      new_value: 'C区-草坪区',
      changed_by: '王五'
    },
    {
      id: 'fh-002',
      inspection_id: 'ins-003',
      field_name: 'pest_level',
      old_value: '中度',
      new_value: '重度',
      changed_by: '王五'
    },
    {
      id: 'fh-003',
      inspection_id: 'ins-003',
      field_name: 'missed_inspection_points',
      old_value: '3',
      new_value: '0',
      changed_by: '王五'
    }
  ];

  const fhStmt = db.prepare(`
    INSERT OR IGNORE INTO field_history 
    (id, inspection_id, field_name, old_value, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  sampleFieldHistory.forEach(fh => {
    fhStmt.run(fh.id, fh.inspection_id, fh.field_name, fh.old_value, fh.new_value, fh.changed_by);
  });
  fhStmt.finalize();

  const sampleRules = [
    {
      id: 'rule-001',
      rule_type: 'seedling_acceptance',
      rule_name: '补苗验收异常规则',
      description: '补苗验收失败时自动标记为待人工处理'
    },
    {
      id: 'rule-002',
      rule_type: 'outsourced_score',
      rule_name: '外包评分人工处理规则',
      description: '外包评分低于70分时需人工审核'
    },
    {
      id: 'rule-003',
      rule_type: 'idempotent',
      rule_name: '重复操作幂等规则',
      description: '相同operation_id的操作只执行一次'
    }
  ];

  const ruleStmt = db.prepare(`
    INSERT OR IGNORE INTO rules 
    (id, rule_type, rule_name, description)
    VALUES (?, ?, ?, ?)
  `);

  sampleRules.forEach(rule => {
    ruleStmt.run(rule.id, rule.rule_type, rule.rule_name, rule.description);
  });
  ruleStmt.finalize();

  console.log('数据库初始化完成，样例数据已导入');
});

db.close();
