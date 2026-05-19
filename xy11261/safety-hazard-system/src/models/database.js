const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/hazards.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hazards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      hazard_level TEXT CHECK(hazard_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('pending', 'rectifying', 'rechecking', 'closed', 'escalated')) DEFAULT 'pending',
      inspector TEXT NOT NULL,
      inspector_photo TEXT,
      inspector_time DATETIME NOT NULL,
      rectifier TEXT,
      rectify_deadline DATETIME,
      rectify_photo TEXT,
      rectify_time DATETIME,
      rectify_description TEXT,
      rechecker TEXT,
      recheck_result TEXT CHECK(recheck_result IN ('pass', 'fail')),
      recheck_photo TEXT,
      recheck_time DATETIME,
      recheck_description TEXT,
      merged_from TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rule_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      action TEXT CHECK(action IN ('block', 'allow', 'escalate', 'merge')) NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_id) REFERENCES hazards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_id) REFERENCES hazards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_hazards_status ON hazards(status);
    CREATE INDEX IF NOT EXISTS idx_hazards_rectifier ON hazards(rectifier);
    CREATE INDEX IF NOT EXISTS idx_hazards_inspector_time ON hazards(inspector_time);
    CREATE INDEX IF NOT EXISTS idx_hazards_location ON hazards(location);
    CREATE INDEX IF NOT EXISTS idx_rule_logs_hazard ON rule_logs(hazard_id);
  `);
};

const initSampleData = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM hazards').get().cnt;
  if (count > 0) return;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const overDue = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const insertHazard = db.prepare(`
    INSERT INTO hazards (
      location, description, hazard_level, status,
      inspector, inspector_photo, inspector_time,
      rectifier, rectify_deadline,
      rectify_photo, rectify_time, rectify_description,
      rechecker, recheck_result, recheck_photo, recheck_time, recheck_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHazard.run(
    'A栋3楼楼梯口', '消防通道堆放杂物，影响疏散', 'medium', 'closed',
    '张三', 'uploads/inspect1.jpg', threeDaysAgo.toISOString(),
    '李四', yesterday.toISOString(),
    'uploads/rectify1.jpg', yesterday.toISOString(), '已清理杂物，通道畅通',
    '王五', 'pass', 'uploads/recheck1.jpg', now.toISOString(), '复查合格，隐患已闭环'
  );

  insertHazard.run(
    'B栋生产车间', '配电箱无警示标识，门未锁', 'high', 'rectifying',
    '张三', 'uploads/inspect2.jpg', yesterday.toISOString(),
    '赵六', tomorrow.toISOString(),
    null, null, null,
    null, null, null, null, null
  );

  insertHazard.run(
    'C栋仓库门口', '地面有积水，易滑倒', 'low', 'pending',
    '李四', null, yesterday.toISOString(),
    null, null,
    null, null, null,
    null, null, null, null, null
  );

  insertHazard.run(
    'A栋3楼楼梯口', '消防通道又堆放纸箱', 'medium', 'pending',
    '王五', 'uploads/inspect3.jpg', now.toISOString(),
    null, null,
    null, null, null,
    null, null, null, null, null
  );

  insertHazard.run(
    'D栋宿舍区', '灭火器过期', 'high', 'escalated',
    '赵六', 'uploads/inspect4.jpg', threeDaysAgo.toISOString(),
    '钱七', overDue.toISOString(),
    null, null, null,
    null, null, null, null, null
  );
};

module.exports = { db, initTables, initSampleData };
