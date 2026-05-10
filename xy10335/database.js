const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'elderly_meal.db');
let db = null;
let SQL = null;

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

async function initDatabase() {
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('数据库加载完成');
  } else {
    db = new SQL.Database();
    console.log('新建数据库');
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS elders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      phone TEXT,
      address TEXT NOT NULL,
      community TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      dietary_preferences TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS elder_forbidden_ingredients (
      elder_id INTEGER,
      ingredient_id INTEGER,
      PRIMARY KEY (elder_id, ingredient_id)
    );

    CREATE TABLE IF NOT EXISTS meal_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10,2),
      ingredients TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elder_id INTEGER NOT NULL,
      package_id INTEGER NOT NULL,
      order_date DATE NOT NULL,
      route_id INTEGER,
      status TEXT DEFAULT 'pending',
      delivery_time DATETIME,
      sign_time DATETIME,
      sign_by TEXT,
      exception_reason TEXT,
      follow_up TEXT,
      is_refunded INTEGER DEFAULT 0,
      refund_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      operation_detail TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  saveDatabase();
  console.log('数据库初始化完成');
}

function seedData() {
  const elderCount = db.exec('SELECT COUNT(*) as count FROM elders')[0].values[0][0];
  if (elderCount > 0) {
    console.log('样例数据已存在，跳过插入');
    return;
  }

  const elders = [
    ['张三', '男', 78, '13800138001', '幸福社区1栋101室', '幸福社区', '张小明', '13900139001', '喜欢清淡口味', '高血压'],
    ['李四', '女', 82, '13800138002', '幸福社区2栋202室', '幸福社区', '李小红', '13900139002', '喜欢甜食', '糖尿病，需注意'],
    ['王五', '男', 75, '13800138003', '快乐社区3栋303室', '快乐社区', '王小明', '13900139003', '喜欢辣味', '对海鲜过敏'],
    ['赵六', '女', 88, '13800138004', '快乐社区4栋404室', '快乐社区', '赵小红', '13900139004', '喜欢软烂食物', '牙齿不好，需要软烂'],
    ['孙七', '男', 70, '13800138005', '和谐社区5栋505室', '和谐社区', '孙小明', '13900139005', '喜欢素食', '肠胃不好'],
  ];

  const elderIds = [];
  const insertElderStmt = db.prepare(`
    INSERT INTO elders (name, gender, age, phone, address, community, contact_person, contact_phone, dietary_preferences, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  elders.forEach(elder => {
    insertElderStmt.run(elder);
    elderIds.push(db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]);
  });

  const ingredients = ['海鲜', '辣椒', '甜食', '坚果', '牛奶', '鸡蛋', '肥肉', '高盐'];
  const insertIngredientStmt = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
  ingredients.forEach(ing => insertIngredientStmt.run([ing]));

  const getIngredientIdStmt = db.prepare('SELECT id FROM ingredients WHERE name = ?');
  const insertForbiddenStmt = db.prepare('INSERT INTO elder_forbidden_ingredients (elder_id, ingredient_id) VALUES (?, ?)');

  const elder1Ingredients = ['肥肉', '高盐'];
  elder1Ingredients.forEach(name => {
    const result = getIngredientIdStmt.getAsObject([name]);
    if (result.length > 0) insertForbiddenStmt.run([elderIds[0], result[0].id]);
  });

  const elder2Ingredients = ['甜食'];
  elder2Ingredients.forEach(name => {
    const result = getIngredientIdStmt.getAsObject([name]);
    if (result.length > 0) insertForbiddenStmt.run([elderIds[1], result[0].id]);
  });

  const elder3Ingredients = ['海鲜'];
  elder3Ingredients.forEach(name => {
    const result = getIngredientIdStmt.getAsObject([name]);
    if (result.length > 0) insertForbiddenStmt.run([elderIds[2], result[0].id]);
  });

  const packages = [
    ['营养套餐A', '清淡营养套餐，适合高血压老人', 15.00, '米饭,清蒸鱼,青菜,豆腐汤'],
    ['营养套餐B', '荤素搭配，营养均衡', 18.00, '米饭,红烧肉,炒时蔬,番茄蛋汤'],
    ['海鲜套餐', '海鲜特色套餐', 25.00, '米饭,清蒸虾,炒时蔬,海鲜汤'],
    ['素食套餐', '纯素套餐，适合素食老人', 12.00, '米饭,炒三素,豆腐,紫菜蛋汤'],
    ['软烂套餐', '适合牙齿不好的老人', 16.00, '稀饭,蒸蛋,炖豆腐,蔬菜泥'],
  ];

  const insertPackageStmt = db.prepare(`
    INSERT INTO meal_packages (name, description, price, ingredients)
    VALUES (?, ?, ?, ?)
  `);

  packages.forEach(pkg => insertPackageStmt.run(pkg));

  const routes = [
    ['路线1-幸福社区', '覆盖幸福社区所有楼栋', '王师傅', '13700137001'],
    ['路线2-快乐社区', '覆盖快乐社区所有楼栋', '李师傅', '13700137002'],
    ['路线3-和谐社区', '覆盖和谐社区所有楼栋', '张师傅', '13700137003'],
  ];

  const insertRouteStmt = db.prepare(`
    INSERT INTO routes (name, description, driver_name, driver_phone)
    VALUES (?, ?, ?, ?)
  `);

  routes.forEach(route => insertRouteStmt.run(route));

  saveDatabase();
  console.log('样例数据插入完成');
}

function resultToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

module.exports = { 
  db, 
  initDatabase, 
  seedData, 
  saveDatabase,
  resultToObjects
};
