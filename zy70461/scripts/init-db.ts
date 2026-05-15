import { db } from '../src/utils/database';

function initDatabase() {
  console.log('开始初始化数据库...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rules JSON NOT NULL,
      effective_from DATETIME NOT NULL,
      effective_to DATETIME,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_name TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments JSON NOT NULL,
      rule_version_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      conclusion TEXT,
      processing_time INTEGER,
      processed_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id)
    );

    CREATE TABLE IF NOT EXISTS history_records (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT NOT NULL,
      source_system TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dependency_changes (
      id TEXT PRIMARY KEY,
      dependency_name TEXT NOT NULL,
      old_version TEXT NOT NULL,
      new_version TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      requester TEXT NOT NULL,
      approver TEXT,
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      both_confirmed BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS process_reports (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      before_stats JSON NOT NULL,
      after_stats JSON NOT NULL,
      execution_time INTEGER NOT NULL,
      processed_count INTEGER NOT NULL,
      next_suggestions JSON NOT NULL,
      rule_version_used TEXT NOT NULL,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions(batch_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_history_submission ON history_records(submission_id);
    CREATE INDEX IF NOT EXISTS idx_rule_versions_active ON rule_versions(is_active);
  `);

  console.log('数据库表创建完成');

  const ruleCount = db.prepare('SELECT COUNT(*) as count FROM rule_versions').get() as { count: number };
  if (ruleCount.count === 0) {
    console.log('插入初始规则版本...');
    
    const insertRule = db.prepare(`
      INSERT INTO rule_versions (id, version, name, description, rules, effective_from, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const initialRules = JSON.stringify({
      attachmentValidDays: 30,
      requireStudentId: true,
      requireCourseCode: true,
      minPageCount: 1,
      maxFileSizeMB: 10,
      allowedFileTypes: ['.pdf', '.doc', '.docx', '.txt'],
      customChecks: []
    });

    insertRule.run(
      'rule-v1-001',
      'v1.0',
      '初始规则版本',
      '手写课程练习提交的初始审核规则',
      initialRules,
      new Date().toISOString(),
      'system'
    );

    console.log('初始规则版本已插入');
  }

  console.log('数据库初始化完成!');
}

if (require.main === module) {
  try {
    initDatabase();
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

export { initDatabase };
