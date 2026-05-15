const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'precheck.db');
const db = new sqlite3.Database(dbPath);

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DROP TABLE IF EXISTS exceptions`);
      db.run(`DROP TABLE IF EXISTS change_history`);
      db.run(`DROP TABLE IF EXISTS material_gaps`);
      db.run(`DROP TABLE IF EXISTS window_acceptances`);
      db.run(`DROP TABLE IF EXISTS correction_opinions`);
      db.run(`DROP TABLE IF EXISTS attachments`);
      db.run(`DROP TABLE IF EXISTS identity_types`);
      db.run(`DROP TABLE IF EXISTS business_matters`);

      db.run(`
        CREATE TABLE business_matters (
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
        CREATE TABLE identity_types (
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
        CREATE TABLE attachments (
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
        CREATE TABLE correction_opinions (
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
        CREATE TABLE window_acceptances (
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
        CREATE TABLE material_gaps (
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
        CREATE TABLE change_history (
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
        CREATE TABLE exceptions (
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
    db.serialize(() => {
      const matters = [
        ['BIZ001', '营业执照办理', '市场监管局', 'active'],
        ['BIZ002', '税务登记证办理', '税务局', 'active'],
        ['BIZ003', '社保开户', '社保局', 'active'],
        ['BIZ004', '公积金开户', '公积金中心', 'active'],
        ['BIZ005', '经营许可证办理', '商务局', 'active']
      ];

      const matterStmt = db.prepare(`
        INSERT INTO business_matters (code, name, department, status)
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
        INSERT INTO identity_types (code, name, description, status)
        VALUES (?, ?, ?, ?)
      `);

      identities.forEach((identity) => {
        identityStmt.run(identity);
      });
      identityStmt.finalize();

      const today = new Date();
      const getDate = (daysFromNow) => {
        const d = new Date(today);
        d.setDate(d.getDate() + daysFromNow);
        return d.toISOString().split('T')[0];
      };

      const attachments = [
        ['营业执照副本', 1, 1, getDate(230), 'valid'],
        ['法人身份证', 1, 1, getDate(2000), 'valid'],
        ['组织机构代码证', 1, 1, getDate(-5), 'valid'],
        ['税务登记证', 2, 1, getDate(300), 'valid'],
        ['经营场所证明', 2, 2, getDate(17), 'valid'],
        ['社保登记证', 3, 1, getDate(-25), 'valid'],
        ['公积金缴存证明', 4, 3, getDate(10), 'valid'],
        ['经营许可证', 5, 4, getDate(31), 'valid'],
        ['银行开户许可证', 2, 1, getDate(5), 'valid']
      ];

      const attachmentStmt = db.prepare(`
        INSERT INTO attachments (name, matter_id, identity_type_id, expire_date, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      attachments.forEach((attachment) => {
        attachmentStmt.run(attachment);
      });
      attachmentStmt.finalize();

      const correctionOpinions = [
        [1, 3, '组织机构代码证有效期不足，请提供最新版本', '张审核', 'pending'],
        [2, 9, '银行开户许可证缺少法人签字，请补正', '李审核', 'pending'],
        [3, 6, '社保登记证地址信息不清晰，请重新扫描', '王审核', 'completed'],
        [5, 8, '经营许可证经营范围需更新', '赵审核', 'pending']
      ];

      const opinionStmt = db.prepare(`
        INSERT INTO correction_opinions (matter_id, attachment_id, opinion, handler, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      correctionOpinions.forEach((opinion) => {
        opinionStmt.run(opinion);
      });
      opinionStmt.finalize();

      const windowAcceptances = [
        [1, 'A01', '王窗口', 'passed', '材料齐全，受理通过'],
        [2, 'A02', '李窗口', 'incomplete', '缺少银行开户许可证，请补正后再提交'],
        [3, 'B01', '张窗口', 'rejected', '社保登记证已过期，需重新办理后再申请'],
        [4, 'B02', '刘窗口', 'pending', '待审核'],
        [5, 'A03', '陈窗口', 'incomplete', '经营许可证附件模糊，请重新上传清晰版本']
      ];

      const acceptanceStmt = db.prepare(`
        INSERT INTO window_acceptances (matter_id, window_no, acceptor, material_check_result, remarks)
        VALUES (?, ?, ?, ?, ?)
      `);

      windowAcceptances.forEach((acceptance) => {
        acceptanceStmt.run(acceptance);
      });
      acceptanceStmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
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
