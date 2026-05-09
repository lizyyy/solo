const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'ticket_merge.db');

let dbInstance = null;

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');

  createTables();
  insertInitialData();

  return dbInstance;
}

function createTables() {
  const db = dbInstance;

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      keywords TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_no TEXT UNIQUE NOT NULL,
      citizen_name TEXT NOT NULL,
      citizen_phone TEXT,
      content TEXT NOT NULL,
      area TEXT,
      location TEXT,
      category TEXT,
      urgency_level TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      primary_keyword TEXT,
      time_window_start DATETIME,
      time_window_end DATETIME,
      complaint_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cluster_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id INTEGER NOT NULL,
      complaint_id INTEGER NOT NULL,
      similarity_score REAL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cluster_id) REFERENCES clusters(id),
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      UNIQUE(cluster_id, complaint_id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      cluster_id INTEGER,
      status TEXT DEFAULT 'pending',
      assigned_department_id INTEGER,
      assigned_at DATETIME,
      deadline DATETIME,
      closed_at DATETIME,
      closed_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cluster_id) REFERENCES clusters(id),
      FOREIGN KEY (assigned_department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_merges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_ticket_id INTEGER NOT NULL,
      source_ticket_id INTEGER NOT NULL,
      merge_reason TEXT,
      merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (source_ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      is_official INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS supervision_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      level TEXT NOT NULL,
      reason TEXT,
      supervisor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS history_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);
    CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
    CREATE INDEX IF NOT EXISTS idx_cluster_members_complaint ON cluster_members(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_department ON tickets(assigned_department_id);
    CREATE INDEX IF NOT EXISTS idx_history_entity ON history_logs(entity_type, entity_id);
  `);
}

function insertInitialData() {
  const db = dbInstance;
  
  const count = db.prepare('SELECT COUNT(*) as cnt FROM departments').get().cnt;
  if (count === 0) {
    const departments = [
      { code: 'WATER', name: '水务局', keywords: '水,供水,排水,自来水,水管,漏水,停水' },
      { code: 'ELECTRIC', name: '供电局', keywords: '电,供电,停电,电表,电线,电力' },
      { code: 'ENVIRONMENT', name: '环保局', keywords: '环境,污染,噪音,气味,垃圾,废水,废气' },
      { code: 'TRAFFIC', name: '交通局', keywords: '交通,堵车,道路,红绿灯,公交,地铁,停车' },
      { code: 'MARKET', name: '市场监管局', keywords: '市场,物价,假货,消费者,投诉,商家' },
      { code: 'HOUSING', name: '住建局', keywords: '房屋,物业,装修,质量,拆迁,建设' },
      { code: 'EDUCATION', name: '教育局', keywords: '教育,学校,学生,教师,学费,入学' },
      { code: 'HEALTH', name: '卫健委', keywords: '医疗,医院,医生,药品,看病,疫情' },
      { code: 'POLICE', name: '公安局', keywords: '治安,报警,警察,盗窃,纠纷,安全' },
      { code: 'COMMUNITY', name: '社区服务中心', keywords: '社区,居委会,便民,服务' }
    ];

    const stmt = db.prepare(`
      INSERT INTO departments (code, name, keywords)
      VALUES (?, ?, ?)
    `);

    for (const dept of departments) {
      stmt.run(dept.code, dept.name, dept.keywords);
    }

    console.log('已初始化部门数据');
  }
}

function getDb() {
  if (!dbInstance) {
    initDb();
  }
  return dbInstance;
}

module.exports = {
  initDb,
  getDb,
  DB_PATH
};
