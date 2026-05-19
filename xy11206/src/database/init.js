const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('数据库连接成功');
});

db.serialize(() => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
      process.exit(1);
    }
    console.log('数据表创建成功');
  });

  const rules = [
    {
      rule_code: 'TEMPERATURE_OUT_OF_RANGE',
      rule_name: '温度越界校验',
      rule_type: 'temperature',
      severity: 'error',
      error_message: '温度超出产品规定范围',
      config_json: JSON.stringify({ check_range: true })
    },
    {
      rule_code: 'DUPLICATE_BATCH_NO',
      rule_name: '批号重复校验',
      rule_type: 'batch',
      severity: 'error',
      error_message: '该批号已存在系统中',
      config_json: JSON.stringify({ check_duplicate: true })
    },
    {
      rule_code: 'MISSING_DAMAGE_PHOTO',
      rule_name: '破损照片缺失校验',
      rule_type: 'damage',
      severity: 'warning',
      error_message: '有破损记录但未上传照片',
      config_json: JSON.stringify({ require_photo: true })
    },
    {
      rule_code: 'INVALID_EXPIRY_DATE',
      rule_name: '有效期校验',
      rule_type: 'expiry',
      severity: 'error',
      error_message: '产品已过期或有效期不足',
      config_json: JSON.stringify({ min_days: 30 })
    },
    {
      rule_code: 'MISSING_RECEIVER_INFO',
      rule_name: '签收人信息校验',
      rule_type: 'receiver',
      severity: 'warning',
      error_message: '签收人信息不完整',
      config_json: JSON.stringify({ require_name: true, require_phone: false })
    }
  ];

  const ruleStmt = db.prepare(`
    INSERT OR IGNORE INTO validation_rules 
    (rule_code, rule_name, rule_type, severity, error_message, config_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  rules.forEach(rule => {
    ruleStmt.run(
      rule.rule_code,
      rule.rule_name,
      rule.rule_type,
      rule.severity,
      rule.error_message,
      rule.config_json
    );
  });
  ruleStmt.finalize();
  console.log('校验规则初始化完成');

  const products = [
    {
      product_code: 'VAC001',
      product_name: '新冠疫苗',
      category: '疫苗',
      manufacturer: '国药集团',
      min_temp: 2,
      max_temp: 8,
      shelf_life_days: 180
    },
    {
      product_code: 'VAC002',
      product_name: '流感疫苗',
      category: '疫苗',
      manufacturer: '科兴生物',
      min_temp: 2,
      max_temp: 8,
      shelf_life_days: 365
    },
    {
      product_code: 'INS001',
      product_name: '甘精胰岛素注射液',
      category: '胰岛素',
      manufacturer: '赛诺菲',
      min_temp: 2,
      max_temp: 8,
      shelf_life_days: 730
    },
    {
      product_code: 'INS002',
      product_name: '门冬胰岛素注射液',
      category: '胰岛素',
      manufacturer: '诺和诺德',
      min_temp: 2,
      max_temp: 8,
      shelf_life_days: 730
    }
  ];

  const productStmt = db.prepare(`
    INSERT OR IGNORE INTO products 
    (product_code, product_name, category, manufacturer, min_temp, max_temp, shelf_life_days)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  products.forEach(product => {
    productStmt.run(
      product.product_code,
      product.product_name,
      product.category,
      product.manufacturer,
      product.min_temp,
      product.max_temp,
      product.shelf_life_days
    );
  });
  productStmt.finalize();
  console.log('产品数据初始化完成');

  console.log('数据库初始化完成！');
  console.log('数据库路径:', dbPath);
});

db.close();
