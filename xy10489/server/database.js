const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, '../data/quality_control.json');

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function getNowDate() {
  return new Date().toISOString().split('T')[0];
}

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('读取数据库失败:', err);
  }
  
  const defaultDB = {
    batches: [],
    defects: [],
    quarantine: [],
    rework_records: [],
    reinspection_decisions: []
  };
  
  writeDB(defaultDB);
  return defaultDB;
}

function writeDB(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('写入数据库失败:', err);
    return false;
  }
}

function sampleData() {
  let db = readDB();
  
  if (db.batches.length > 0) return db;

  const now = getTimestamp();
  const today = getNowDate();
  
  const batches = [
    {
      id: 1,
      batch_no: 'P2024-0501-001',
      product_name: '精密轴承',
      model: 'BR-001',
      quantity: 5000,
      production_line: 'A线',
      inspector: '张工',
      production_date: today,
      status: '待处理',
      created_at: now,
      updated_at: now
    },
    {
      id: 2,
      batch_no: 'P2024-0501-002',
      product_name: '密封垫圈',
      model: 'SR-102',
      quantity: 10000,
      production_line: 'B线',
      inspector: '李工',
      production_date: today,
      status: '隔离中',
      created_at: now,
      updated_at: now
    },
    {
      id: 3,
      batch_no: 'P2024-0502-001',
      product_name: '齿轮组件',
      model: 'GR-200',
      quantity: 2000,
      production_line: 'A线',
      inspector: '王工',
      production_date: today,
      status: '完成',
      created_at: now,
      updated_at: now
    }
  ];

  const defects = [
    {
      id: 1,
      batch_id: 1,
      defect_type: '轻微外观缺陷',
      severity: '轻微',
      quantity: 5,
      description: '表面划痕，不影响功能',
      detected_by: '质检员A',
      detected_at: now
    },
    {
      id: 2,
      batch_id: 2,
      defect_type: '严重尺寸不良',
      severity: '严重',
      quantity: 32,
      description: '外径偏差超出公差范围',
      detected_by: '质检员B',
      detected_at: now
    },
    {
      id: 3,
      batch_id: 3,
      defect_type: '轻微外观缺陷',
      severity: '轻微',
      quantity: 10,
      description: '轻微氧化斑点',
      detected_by: '质检员A',
      detected_at: now
    }
  ];

  const quarantine = [
    {
      id: 1,
      batch_id: 1,
      quantity: 10,
      reason: '抽检发现外观缺陷，待复判',
      quarantined_by: '张工',
      status: '隔离中',
      created_at: now,
      released_at: null,
      released_by: null,
      release_confirmation: null
    },
    {
      id: 2,
      batch_id: 2,
      quantity: 150,
      reason: '尺寸不良，暂停使用',
      quarantined_by: '李工',
      status: '隔离中',
      created_at: now,
      released_at: null,
      released_by: null,
      release_confirmation: null
    }
  ];

  const rework_records = [
    {
      id: 1,
      batch_id: 3,
      defect_id: 3,
      quantity: 10,
      rework_method: '抛光处理',
      reworked_by: '赵师傅',
      rework_start: now,
      rework_end: now,
      recheck_result: '合格',
      rechecked_by: '王工',
      rechecked_at: now,
      status: '已复检'
    }
  ];

  const reinspection_decisions = [
    {
      id: 1,
      batch_id: 3,
      decision: '入库',
      quantity: 2000,
      reason: '复检合格，全部通过',
      approval_basis: 'GB/T 307.1-2017 标准',
      approved_by: '质量经理',
      decided_at: now,
      status: '已执行'
    }
  ];

  db = {
    batches,
    defects,
    quarantine,
    rework_records,
    reinspection_decisions
  };

  writeDB(db);
  return db;
}

module.exports = {
  readDB,
  writeDB,
  sampleData,
  getTimestamp,
  getNowDate
};
