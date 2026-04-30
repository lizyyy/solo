const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

const createTables = async () => {
  const SQL = await initSqlJs();
  
  let db;
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('数据库已存在，打开现有数据库');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
  }

  const createSamplesTable = `
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT '',
      location TEXT DEFAULT '',
      deposit REAL DEFAULT 0,
      value REAL DEFAULT 0,
      status TEXT DEFAULT 'AVAILABLE',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createBorrowRecordsTable = `
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sampleId INTEGER NOT NULL,
      borrowerName TEXT NOT NULL,
      borrowerContact TEXT DEFAULT '',
      expectedReturnDate DATETIME NOT NULL,
      actualReturnDate DATETIME,
      damageNote TEXT,
      status TEXT DEFAULT 'BORROWED',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sampleId) REFERENCES samples(id)
    );
  `;

  const createSamplesIndex = `
    CREATE INDEX IF NOT EXISTS idx_samples_code ON samples(code);
  `;

  const createBorrowRecordsIndex = `
    CREATE INDEX IF NOT EXISTS idx_borrow_records_sampleId ON borrow_records(sampleId);
  `;

  try {
    db.run(createSamplesTable);
    db.run(createBorrowRecordsTable);
    db.run(createSamplesIndex);
    db.run(createBorrowRecordsIndex);
    
    console.log('数据库表创建成功');

    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('数据库保存成功:', dbPath);

    db.close();
  } catch (error) {
    console.error('创建数据库表失败:', error);
    throw error;
  }
};

createTables()
  .then(() => console.log('数据库初始化完成'))
  .catch((error) => {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  });
