const db = require('../src/models/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT UNIQUE NOT NULL,
      vendor_name TEXT,
      business_license TEXT,
      business_license_expiry DATE,
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      payment_bank TEXT,
      payment_account TEXT,
      payment_account_name TEXT,
      status TEXT DEFAULT 'pending',
      raw_input TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS validation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      required INTEGER DEFAULT 1,
      validation_type TEXT,
      validation_pattern TEXT,
      error_message TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS validation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT NOT NULL,
      validation_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      raw_input TEXT,
      validation_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_code) REFERENCES vendors(vendor_code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS missing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      validation_id TEXT NOT NULL,
      vendor_code TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (validation_id) REFERENCES validation_records(validation_id),
      FOREIGN KEY (vendor_code) REFERENCES vendors(vendor_code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS correction_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT NOT NULL,
      validation_id TEXT,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      corrected_by TEXT,
      correction_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_code) REFERENCES vendors(vendor_code),
      FOREIGN KEY (validation_id) REFERENCES validation_records(validation_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS validation_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT UNIQUE NOT NULL,
      vendor_code TEXT NOT NULL,
      validation_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      report_content TEXT,
      status TEXT DEFAULT 'generated',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_code) REFERENCES vendors(vendor_code),
      FOREIGN KEY (validation_id) REFERENCES validation_records(validation_id)
    )
  `);

  const rules = [
    { field_name: 'vendor_name', field_label: '供应商名称', required: 1, validation_type: 'not_empty', error_message: '供应商名称不能为空' },
    { field_name: 'business_license', field_label: '营业执照号', required: 1, validation_type: 'pattern', validation_pattern: '^[A-Z0-9]{15,18}$', error_message: '营业执照号格式不正确' },
    { field_name: 'business_license_expiry', field_label: '营业执照有效期', required: 1, validation_type: 'date', error_message: '营业执照有效期格式不正确' },
    { field_name: 'contact_person', field_label: '联系人', required: 1, validation_type: 'not_empty', error_message: '联系人不能为空' },
    { field_name: 'contact_phone', field_label: '联系电话', required: 1, validation_type: 'pattern', validation_pattern: '^1[3-9]\\d{9}$', error_message: '联系电话格式不正确' },
    { field_name: 'contact_email', field_label: '联系邮箱', required: 1, validation_type: 'email', error_message: '联系邮箱格式不正确' },
    { field_name: 'payment_bank', field_label: '开户银行', required: 1, validation_type: 'not_empty', error_message: '开户银行不能为空' },
    { field_name: 'payment_account', field_label: '银行账号', required: 1, validation_type: 'pattern', validation_pattern: '^\\d{10,25}$', error_message: '银行账号格式不正确' },
    { field_name: 'payment_account_name', field_label: '账户名称', required: 1, validation_type: 'not_empty', error_message: '账户名称不能为空' }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO validation_rules (field_name, field_label, required, validation_type, validation_pattern, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  rules.forEach(rule => {
    stmt.run(rule.field_name, rule.field_label, rule.required, rule.validation_type, rule.validation_pattern, rule.error_message);
  });

  stmt.finalize(() => {
    console.log('数据库表和校验规则初始化完成');
    db.close();
  });
});
