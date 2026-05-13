const db = require('../database/db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS linen_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_code TEXT UNIQUE NOT NULL,
      linen_type TEXT NOT NULL,
      size TEXT,
      floor TEXT,
      room_number TEXT,
      status TEXT DEFAULT 'in_room',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS linen_tag_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS floor_handover (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      floor TEXT NOT NULL,
      handover_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      handler TEXT NOT NULL,
      receiver TEXT,
      handover_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS floor_handover_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handover_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (handover_id) REFERENCES floor_handover(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS factory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_type TEXT NOT NULL,
      linen_tag_id INTEGER NOT NULL,
      factory_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      sender TEXT,
      receiver TEXT,
      transaction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      vehicle_number TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS factory_transaction_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES factory_transactions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS damage_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      factory_transaction_id INTEGER,
      photo_path TEXT NOT NULL,
      damage_type TEXT NOT NULL,
      damage_level TEXT NOT NULL,
      description TEXT,
      reported_by TEXT NOT NULL,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_reviewed BOOLEAN DEFAULT 0,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_result TEXT,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id),
      FOREIGN KEY (factory_transaction_id) REFERENCES factory_transactions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      linen_type TEXT NOT NULL,
      damage_type TEXT NOT NULL,
      damage_level TEXT NOT NULL,
      compensation_amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      damage_photo_id INTEGER NOT NULL,
      rule_id INTEGER NOT NULL,
      compensation_amount DECIMAL(10,2) NOT NULL,
      responsible_party TEXT NOT NULL,
      responsible_person TEXT,
      deducted BOOLEAN DEFAULT 0,
      deducted_at DATETIME,
      deducted_by TEXT,
      deduplication_key TEXT UNIQUE,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id),
      FOREIGN KEY (damage_photo_id) REFERENCES damage_photos(id),
      FOREIGN KEY (rule_id) REFERENCES compensation_rules(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_restock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      restock_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      source TEXT,
      handler TEXT NOT NULL,
      restock_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_tag_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      status_text TEXT NOT NULL,
      operator TEXT NOT NULL,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      related_id INTEGER,
      related_type TEXT,
      FOREIGN KEY (linen_tag_id) REFERENCES linen_tags(id)
    )
  `);

  console.log('数据库表创建完成');

  const insertRules = db.prepare(`
    INSERT OR IGNORE INTO compensation_rules (rule_name, linen_type, damage_type, damage_level, compensation_amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const rules = [
    ['床单轻微破损赔偿', '床单', '破损', '轻微', 20.00, '床单轻微破损，面积小于5cm'],
    ['床单中度破损赔偿', '床单', '破损', '中度', 50.00, '床单中度破损，面积5-20cm'],
    ['床单严重破损赔偿', '床单', '破损', '严重', 100.00, '床单严重破损，无法继续使用'],
    ['被套轻微破损赔偿', '被套', '破损', '轻微', 30.00, '被套轻微破损，面积小于5cm'],
    ['被套中度破损赔偿', '被套', '破损', '中度', 70.00, '被套中度破损，面积5-20cm'],
    ['被套严重破损赔偿', '被套', '破损', '严重', 150.00, '被套严重破损，无法继续使用'],
    ['毛巾轻微污渍赔偿', '毛巾', '污渍', '轻微', 10.00, '毛巾轻微污渍，可洗涤去除'],
    ['毛巾严重污渍赔偿', '毛巾', '污渍', '严重', 30.00, '毛巾严重污渍，无法洗涤去除'],
    ['浴袍破损赔偿', '浴袍', '破损', '中度', 80.00, '浴袍破损赔偿']
  ];

  rules.forEach(rule => {
    insertRules.run(rule, (err) => {
      if (err) console.error('插入规则失败:', err);
    });
  });

  insertRules.finalize(() => {
    console.log('赔付规则初始化完成');
  });

  const insertLinen = db.prepare(`
    INSERT OR IGNORE INTO linen_tags (tag_code, linen_type, size, floor, room_number, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const linenData = [
    ['LN001', '床单', '大号', '3F', '301', 'in_room'],
    ['LN002', '被套', '大号', '3F', '302', 'in_room'],
    ['LN003', '毛巾', '中号', '5F', '501', 'in_room'],
    ['LN004', '浴袍', '均码', '5F', '502', 'in_room'],
    ['LN005', '床单', '大号', '7F', '701', 'in_room']
  ];

  linenData.forEach(linen => {
    insertLinen.run(linen, (err) => {
      if (err) console.error('插入布草失败:', err);
    });
  });

  insertLinen.finalize(() => {
    console.log('样例布草数据初始化完成');
    db.close();
  });
});