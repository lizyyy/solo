const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB = {
  materials: [],
  meetingMinutes: [],
  collisionPoints: [],
  fieldMappings: {
    会议日期: ['meetingDate', 'date', '日期', '开会时间'],
    材料编号: ['materialNo', 'materialId', '编号', '图号'],
    碰撞描述: ['collisionDesc', '问题描述', '描述', 'collision'],
    负责人: ['owner', '处理人', '责任人'],
    截止日期: ['deadline', '完成时间', '要求日期'],
    状态: ['status', '处理状态', '当前状态']
  },
  meta: {
    lastUpdated: null,
    version: 1
  }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
}

function loadDB() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);
    if (!db.fieldMappings) db.fieldMappings = DEFAULT_DB.fieldMappings;
    if (!db.meta) db.meta = DEFAULT_DB.meta;
    if (!db.materials) db.materials = [];
    if (!db.meetingMinutes) db.meetingMinutes = [];
    if (!db.collisionPoints) db.collisionPoints = [];
    return db;
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function saveDB(db) {
  ensureDataDir();
  db.meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

module.exports = { loadDB, saveDB, DEFAULT_DB };
