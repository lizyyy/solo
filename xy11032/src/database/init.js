const db = require('./db');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function init() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS 器械档案 (
      器械编号 TEXT PRIMARY KEY,
      器械名称 TEXT NOT NULL,
      器械类别 TEXT NOT NULL,
      规格型号 TEXT,
      生产厂家 TEXT,
      购入日期 DATE,
      消毒有效期 INTEGER,
      当前状态 TEXT DEFAULT '在库',
      当前位置 TEXT,
      备注 TEXT
    );

    CREATE TABLE IF NOT EXISTS 借还明细 (
      记录编号 INTEGER PRIMARY KEY AUTOINCREMENT,
      器械编号 TEXT NOT NULL,
      借用人工号 TEXT NOT NULL,
      借用人姓名 TEXT NOT NULL,
      借用科室 TEXT NOT NULL,
      借用日期时间 DATETIME NOT NULL,
      预计归还日期 DATE,
      借用用途 TEXT,
      归还人工号 TEXT,
      归还人姓名 TEXT,
      归还日期时间 DATETIME,
      消毒状态 TEXT DEFAULT '未消毒',
      消毒日期 DATE,
      消毒人工号 TEXT,
      状态 TEXT DEFAULT '借用中',
      异常说明 TEXT,
      FOREIGN KEY (器械编号) REFERENCES 器械档案(器械编号)
    );

    CREATE TABLE IF NOT EXISTS 消毒记录 (
      消毒编号 INTEGER PRIMARY KEY AUTOINCREMENT,
      器械编号 TEXT NOT NULL,
      消毒日期 DATE NOT NULL,
      消毒人工号 TEXT NOT NULL,
      消毒方式 TEXT NOT NULL,
      消毒时长 INTEGER,
      有效期至 DATE NOT NULL,
      备注 TEXT,
      FOREIGN KEY (器械编号) REFERENCES 器械档案(器械编号)
    );

    CREATE TABLE IF NOT EXISTS 操作人员 (
      人工号 TEXT PRIMARY KEY,
      姓名 TEXT NOT NULL,
      科室 TEXT,
      角色 TEXT DEFAULT '普通用户'
    );
  `);

  console.log('数据库表结构创建完成');
}

module.exports = init;
