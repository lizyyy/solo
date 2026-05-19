const { runQuery, getOne, serialize } = require('./connection');
const { logOperation, logError } = require('../utils/logger');

const createTables = async () => {
  try {
    await serialize();
    
    await runQuery(`
      CREATE TABLE IF NOT EXISTS operators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        idCard TEXT,
        bankAccount TEXT,
        status TEXT DEFAULT 'active',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS tractors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plateNumber TEXT UNIQUE NOT NULL,
        model TEXT,
        type TEXT,
        horsepower INTEGER,
        status TEXT DEFAULT 'active',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS work_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recordNo TEXT UNIQUE NOT NULL,
        operatorId INTEGER NOT NULL,
        tractorId INTEGER NOT NULL,
        workDate TEXT NOT NULL,
        workType TEXT NOT NULL,
        fieldName TEXT,
        hours REAL,
        acres REAL,
        fuelConsumption REAL,
        remarks TEXT,
        status TEXT DEFAULT 'pending',
        importBatchNo TEXT,
        validationErrors TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (operatorId) REFERENCES operators (id),
        FOREIGN KEY (tractorId) REFERENCES tractors (id)
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS billing_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workRecordId INTEGER NOT NULL,
        hoursFee REAL DEFAULT 0,
        acresFee REAL DEFAULT 0,
        fuelFee REAL DEFAULT 0,
        serviceFee REAL DEFAULT 0,
        totalAmount REAL NOT NULL,
        billingDate TEXT NOT NULL,
        status TEXT DEFAULT 'unpaid',
        remarks TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (workRecordId) REFERENCES work_records (id)
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workRecordId INTEGER NOT NULL,
        reviewer TEXT NOT NULL,
        reviewResult TEXT NOT NULL,
        reviewComments TEXT,
        reviewDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (workRecordId) REFERENCES work_records (id)
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        operator TEXT NOT NULL,
        targetType TEXT,
        targetId INTEGER,
        details TEXT,
        createdAt TEXT NOT NULL
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchNo TEXT UNIQUE NOT NULL,
        fileName TEXT NOT NULL,
        totalRecords INTEGER DEFAULT 0,
        successRecords INTEGER DEFAULT 0,
        failedRecords INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processing',
        importedBy TEXT,
        createdAt TEXT NOT NULL
      )
    `);

    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_work_records_status ON work_records(status)
    `);
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_work_records_date ON work_records(workDate)
    `);
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(status)
    `);

    logOperation('database_init', 'system', { message: '数据库表初始化完成' });
    console.log('数据库表初始化完成');
  } catch (error) {
    logError('database_init', error);
    throw error;
  }
};

const initBasicData = async () => {
  try {
    const now = new Date().toISOString();
    
    const operatorCount = await getOne('SELECT COUNT(*) as count FROM operators');
    if (operatorCount.count === 0) {
      await runQuery(`
        INSERT INTO operators (name, phone, idCard, bankAccount, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['张三', '13800138001', '110101198001011234', '6222021234567890123', 'active', now, now]);
      
      await runQuery(`
        INSERT INTO operators (name, phone, idCard, bankAccount, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['李四', '13900139002', '110101198502022345', '6222021234567890456', 'active', now, now]);
      
      await runQuery(`
        INSERT INTO operators (name, phone, idCard, bankAccount, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['王五', '13700137003', '110101199003033456', '6222021234567890789', 'active', now, now]);
    }

    const tractorCount = await getOne('SELECT COUNT(*) as count FROM tractors');
    if (tractorCount.count === 0) {
      await runQuery(`
        INSERT INTO tractors (plateNumber, model, type, horsepower, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['皖01-12345', '东方红LX904', '轮式拖拉机', 90, 'active', now, now]);
      
      await runQuery(`
        INSERT INTO tractors (plateNumber, model, type, horsepower, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['皖01-67890', '雷沃M1004', '轮式拖拉机', 100, 'active', now, now]);
      
      await runQuery(`
        INSERT INTO tractors (plateNumber, model, type, horsepower, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['皖01-11111', '约翰迪尔5E-954', '轮式拖拉机', 95, 'active', now, now]);
    }

    logOperation('basic_data_init', 'system', { message: '基础数据初始化完成' });
    console.log('基础数据初始化完成');
  } catch (error) {
    logError('basic_data_init', error);
    throw error;
  }
};

const initDatabase = async () => {
  await createTables();
  await initBasicData();
};

module.exports = initDatabase;
