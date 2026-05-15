const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS business_matters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          department TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS identity_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          matter_id INTEGER,
          identity_type_id INTEGER,
          expire_date TEXT,
          status TEXT DEFAULT 'valid',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matter_id) REFERENCES business_matters(id),
          FOREIGN KEY (identity_type_id) REFERENCES identity_types(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS correction_opinions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matter_id INTEGER,
          attachment_id INTEGER,
          opinion TEXT NOT NULL,
          handler TEXT,
          handle_time TEXT,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matter_id) REFERENCES business_matters(id),
          FOREIGN KEY (attachment_id) REFERENCES attachments(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS window_acceptances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matter_id INTEGER,
          window_no TEXT,
          acceptor TEXT,
          accept_time TEXT,
          material_check_result TEXT,
          remarks TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matter_id) REFERENCES business_matters(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS material_gaps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matter_id INTEGER,
          identity_type_id INTEGER,
          gap_type TEXT NOT NULL,
          gap_description TEXT NOT NULL,
          attachment_id INTEGER,
          severity TEXT DEFAULT 'normal',
          is_resolved INTEGER DEFAULT 0,
          resolved_by TEXT,
          resolved_time TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matter_id) REFERENCES business_matters(id),
          FOREIGN KEY (identity_type_id) REFERENCES identity_types(id),
          FOREIGN KEY (attachment_id) REFERENCES attachments(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS change_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by TEXT,
          changed_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS exceptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          matter_id INTEGER,
          exception_type TEXT NOT NULL,
          reason TEXT NOT NULL,
          attachment_id INTEGER,
          handler TEXT,
          before_value TEXT,
          after_value TEXT,
          is_fixed INTEGER DEFAULT 0,
          fixed_time TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matter_id) REFERENCES business_matters(id),
          FOREIGN KEY (attachment_id) REFERENCES attachments(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const insertData = () => {
  return new Promise((resolve, reject) => {
    const matters = [
      ['BIZ001', '营业执照办理', '市场监管局', 'active'],
      ['BIZ002', '税务登记证办理', '税务局', 'active'],
      ['BIZ003', '社保开户', '社保局', 'active'],
      ['BIZ004', '公积金开户', '公积金中心', 'active'],
      ['BIZ005', '经营许可证办理', '商务局', 'active']
    ];

    const matterStmt = db.prepare(`
      INSERT OR IGNORE INTO business_matters (code, name, department, status)
      VALUES (?, ?, ?, ?)
    `);

    matters.forEach((matter) => {
      matterStmt.run(matter);
    });
    matterStmt.finalize();

    const identities = [
      ['ID001', '企业法人', '企业法定代表人身份证明', 'active'],
      ['ID002', '个体工商户', '个体工商户经营者身份证明', 'active'],
      ['ID003', '事业单位法人', '事业单位法定代表人身份证明', 'active'],
      ['ID004', '社会组织', '社会组织负责人身份证明', 'active'],
      ['ID005', '自然人', '个人身份证明', 'active']
    ];

    const identityStmt = db.prepare(`
      INSERT OR IGNORE INTO identity_types (code, name, description, status)
      VALUES (?, ?, ?, ?)
    `);

    identities.forEach((identity) => {
      identityStmt.run(identity);
    });
    identityStmt.finalize();

    const attachments = [
      ['营业执照副本', 1, 1, '2025-12-31', 'valid'],
      ['法人身份证', 1, 1, '2030-06-15', 'valid'],
      ['组织机构代码证', 1, 1, '2024-06-30', 'expired'],
      ['税务登记证', 2, 1, '2026-03-20', 'valid'],
      ['经营场所证明', 2, 2, '2025-08-10', 'valid'],
      ['社保登记证', 3, 1, '2024-11-05', 'expired'],
      ['公积金缴存证明', 4, 3, '2025-04-18', 'valid'],
      ['经营许可证', 5, 4, '2024-09-22', 'expired']
    ];

    const attachmentStmt = db.prepare(`
      INSERT OR IGNORE INTO attachments (name, matter_id, identity_type_id, expire_date, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    attachments.forEach((attachment) => {
      attachmentStmt.run(attachment);
    });
    attachmentStmt.finalize();

    const gaps = [
      [1, 1, 'expired', '组织机构代码证已过期，请更新', 3, 'high', 0],
      [3, 1, 'expired', '社保登记证已过期，请更新', 6, 'high', 0],
      [5, 4, 'expired', '经营许可证即将过期，请及时更新', 8, 'medium', 0],
      [2, 1, 'missing', '缺少银行开户许可证', null, 'high', 0],
      [4, 3, 'incomplete', '公积金缴存证明信息不完整', 7, 'medium', 0]
    ];

    const gapStmt = db.prepare(`
      INSERT OR IGNORE INTO material_gaps (matter_id, identity_type_id, gap_type, gap_description, attachment_id, severity, is_resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    gaps.forEach((gap) => {
      gapStmt.run(gap);
    });
    gapStmt.finalize();

    const exceptions = [
      [1, 'attachment_expired', '组织机构代码证有效期不足30天', 3, '张三', '2024-06-30', '2025-06-30', 1],
      [2, 'material_missing', '银行开户许可证未上传', null, '李四', null, '已上传', 0],
      [3, 'attachment_expired', '社保登记证已过期', 6, '王五', '2024-11-05', '2025-11-05', 1],
      [4, 'info_incomplete', '公积金缴存证明缺少单位公章', 7, '赵六', '无公章', '有公章', 0],
      [5, 'attachment_expired', '经营许可证即将过期', 8, null, null, null, 0]
    ];

    const exceptionStmt = db.prepare(`
      INSERT OR IGNORE INTO exceptions (matter_id, exception_type, reason, attachment_id, handler, before_value, after_value, is_fixed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    exceptions.forEach((exception) => {
      exceptionStmt.run(exception);
    });
    exceptionStmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

initTables()
  .then(insertData)
  .then(() => {
    console.log('数据库初始化完成！');
    db.close();
  })
  .catch((err) => {
    console.error('初始化失败:', err);
    db.close();
  });
