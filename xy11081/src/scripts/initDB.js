const db = require('../config/database');

const initTables = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS spare_parts_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code TEXT NOT NULL UNIQUE,
      part_name TEXT NOT NULL,
      part_spec TEXT,
      part_category TEXT,
      unit TEXT NOT NULL,
      safe_stock_quantity INTEGER NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      in_transit_quantity INTEGER NOT NULL DEFAULT 0,
      min_order_quantity INTEGER DEFAULT 1,
      supplier_name TEXT,
      supplier_contact TEXT,
      average_daily_consumption REAL DEFAULT 0,
      lead_time_days INTEGER DEFAULT 7,
      last_purchase_date TEXT,
      last_consumption_date TEXT,
      location TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code TEXT NOT NULL,
      part_name TEXT NOT NULL,
      suggested_quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      current_stock INTEGER,
      safe_stock INTEGER,
      in_transit INTEGER,
      expected_stockout_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_part_code ON spare_parts_inventory(part_code);
    CREATE INDEX IF NOT EXISTS idx_category ON spare_parts_inventory(part_category);
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
    } else {
      console.log('数据表创建成功');
      insertSampleData();
    }
  });
};

const insertSampleData = () => {
  const sampleData = [
    {
      part_code: 'BJ-001',
      part_name: '轴承',
      part_spec: '6205-2RS',
      part_category: '传动部件',
      unit: '个',
      safe_stock_quantity: 50,
      current_stock: 25,
      in_transit_quantity: 0,
      min_order_quantity: 20,
      supplier_name: '轴承贸易有限公司',
      supplier_contact: '张经理 13800138001',
      average_daily_consumption: 2.5,
      lead_time_days: 5,
      location: 'A区-01-03',
      remarks: '常用易损件，需重点监控'
    },
    {
      part_code: 'DQ-002',
      part_name: '交流电机',
      part_spec: 'Y100L1-4 2.2KW',
      part_category: '电气部件',
      unit: '台',
      safe_stock_quantity: 3,
      current_stock: 1,
      in_transit_quantity: 2,
      min_order_quantity: 1,
      supplier_name: '电机制造有限公司',
      supplier_contact: '李工 13900139002',
      average_daily_consumption: 0.1,
      lead_time_days: 15,
      location: 'B区-02-01',
      remarks: '采购周期较长，已在途2台'
    },
    {
      part_code: 'YD-003',
      part_name: '液压油',
      part_spec: 'L-HM46 200L',
      part_category: '油品',
      unit: '桶',
      safe_stock_quantity: 10,
      current_stock: 8,
      in_transit_quantity: 0,
      min_order_quantity: 5,
      supplier_name: '润滑油科技有限公司',
      supplier_contact: '王总 13700137003',
      average_daily_consumption: 0.3,
      lead_time_days: 3,
      location: 'C区-01-01',
      remarks: '定期更换，注意保质期'
    },
    {
      part_code: 'MF-004',
      part_name: '密封垫圈',
      part_spec: 'φ50×φ35×5',
      part_category: '密封件',
      unit: '个',
      safe_stock_quantity: 100,
      current_stock: 120,
      in_transit_quantity: 50,
      min_order_quantity: 50,
      supplier_name: '密封件厂',
      supplier_contact: '赵女士 13600136004',
      average_daily_consumption: 8,
      lead_time_days: 7,
      location: 'A区-03-02',
      remarks: '库存充足，但在途重复计算风险'
    },
    {
      part_code: 'KG-005',
      part_name: '空气滤芯',
      part_spec: 'K3046',
      part_category: '过滤部件',
      unit: '个',
      safe_stock_quantity: 20,
      current_stock: 5,
      in_transit_quantity: 0,
      min_order_quantity: 10,
      supplier_name: '滤清器制造有限公司',
      supplier_contact: '孙经理 13500135005',
      average_daily_consumption: 1.2,
      lead_time_days: 10,
      location: 'D区-01-04',
      remarks: '即将缺货，急需采购'
    }
  ];

  const placeholders = sampleData.map(() => 
    '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)'
  ).join(',');

  const values = sampleData.flatMap(item => [
    item.part_code, item.part_name, item.part_spec, item.part_category,
    item.unit, item.safe_stock_quantity, item.current_stock,
    item.in_transit_quantity, item.min_order_quantity,
    item.supplier_name, item.supplier_contact, item.average_daily_consumption,
    item.lead_time_days, item.location, item.remarks
  ]);

  const insertSql = `
    INSERT OR IGNORE INTO spare_parts_inventory (
      part_code, part_name, part_spec, part_category, unit,
      safe_stock_quantity, current_stock, in_transit_quantity,
      min_order_quantity, supplier_name, supplier_contact,
      average_daily_consumption, lead_time_days, location, remarks,
      created_at, updated_at
    ) VALUES ${placeholders}
  `;

  db.run(insertSql, values, function(err) {
    if (err) {
      console.error('插入样例数据失败:', err.message);
    } else {
      console.log(`样例数据插入成功，共 ${sampleData.length} 条记录`);
    }
    db.close();
  });
};

initTables();
