const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const greenhouses = [
  {
    id: 'GH-001',
    name: '玫瑰温室A区',
    location: '山东省济南市历城区',
    area: 1200.5,
    flower_types: '红玫瑰,白玫瑰,粉玫瑰'
  },
  {
    id: 'GH-002',
    name: '月季温室B区',
    location: '云南省昆明市呈贡区',
    area: 850.0,
    flower_types: '大花月季,丰花月季,微型月季'
  },
  {
    id: 'GH-003',
    name: '兰花温室C区',
    location: '广东省广州市芳村区',
    area: 650.8,
    flower_types: '蝴蝶兰,大花蕙兰,石斛兰'
  },
  {
    id: 'GH-004',
    name: '康乃馨温室D区',
    location: '云南省昆明市晋宁区',
    area: 980.0,
    flower_types: '红色康乃馨,粉色康乃馨,黄色康乃馨'
  }
];

const diseaseWarnings = [
  {
    id: 'WARN-001',
    greenhouse_id: 'GH-001',
    warning_no: '2024-GH001-DIS-001',
    disease_type: '白粉病',
    severity_level: 'medium',
    affected_area: 150.5,
    detected_date: '2024-05-10 08:30:00',
    reporter: '张农艺师',
    status: 'confirmed',
    description: '发现叶片表面有白色粉状物，主要集中在中部区域',
    temperature: 22.5,
    humidity: 78,
    ph_value: 6.2,
    fertilizer_used: '复合肥NPK 15-15-15',
    pesticide_applied: '三唑酮',
    version: 1
  },
  {
    id: 'WARN-002',
    greenhouse_id: 'GH-001',
    warning_no: '2024-GH001-DIS-002',
    disease_type: '黑斑病',
    severity_level: 'high',
    affected_area: 280.0,
    detected_date: '2024-05-12 14:20:00',
    reporter: '李技术员',
    status: 'pending',
    description: '叶片出现黑色圆形斑点，有扩散趋势',
    temperature: 25.0,
    humidity: 85,
    ph_value: 5.8,
    fertilizer_used: '有机肥',
    pesticide_applied: '',
    version: 1
  },
  {
    id: 'WARN-003',
    greenhouse_id: 'GH-002',
    warning_no: '2024-GH002-DIS-001',
    disease_type: '灰霉病',
    severity_level: 'low',
    affected_area: 45.0,
    detected_date: '2024-05-08 09:15:00',
    reporter: '王管理员',
    status: 'resolved',
    description: '花瓣边缘出现褐色霉层，已及时处理',
    temperature: 20.0,
    humidity: 72,
    ph_value: 6.5,
    fertilizer_used: '磷酸二氢钾',
    pesticide_applied: '腐霉利',
    version: 2
  }
];

const warningHistory = [
  {
    warning_id: 'WARN-003',
    field_changed: 'status',
    old_value: 'pending',
    new_value: 'confirmed',
    changed_by: '王管理员'
  },
  {
    warning_id: 'WARN-003',
    field_changed: 'status',
    old_value: 'confirmed',
    new_value: 'resolved',
    changed_by: '李主管'
  },
  {
    warning_id: 'WARN-003',
    field_changed: 'version',
    old_value: '1',
    new_value: '2',
    changed_by: '系统'
  }
];

function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS greenhouses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          area REAL NOT NULL,
          flower_types TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS disease_warnings (
          id TEXT PRIMARY KEY,
          greenhouse_id TEXT NOT NULL,
          warning_no TEXT UNIQUE NOT NULL,
          disease_type TEXT NOT NULL,
          severity_level TEXT NOT NULL CHECK(severity_level IN ('low', 'medium', 'high', 'critical')),
          affected_area REAL NOT NULL,
          detected_date DATETIME NOT NULL,
          reporter TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'resolved', 'withdrawn', 'reapplied')),
          description TEXT,
          temperature REAL,
          humidity REAL,
          ph_value REAL,
          fertilizer_used TEXT,
          pesticide_applied TEXT,
          previous_warning_id TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id),
          FOREIGN KEY (previous_warning_id) REFERENCES disease_warnings(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS warning_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          warning_id TEXT NOT NULL,
          field_changed TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by TEXT NOT NULL,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (warning_id) REFERENCES disease_warnings(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS warning_consistency_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          greenhouse_id TEXT NOT NULL,
          check_date DATE NOT NULL,
          warning_count INTEGER NOT NULL,
          expected_count INTEGER NOT NULL,
          is_consistent BOOLEAN NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function insertGreenhouses(db) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO greenhouses (id, name, location, area, flower_types) VALUES (?, ?, ?, ?, ?)');
    let completed = 0;
    greenhouses.forEach(gh => {
      stmt.run(gh.id, gh.name, gh.location, gh.area, gh.flower_types, (err) => {
        if (err) return reject(err);
        completed++;
        if (completed === greenhouses.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

function insertWarnings(db) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO disease_warnings 
      (id, greenhouse_id, warning_no, disease_type, severity_level, affected_area,
       detected_date, reporter, status, description, temperature, humidity,
       ph_value, fertilizer_used, pesticide_applied, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let completed = 0;
    diseaseWarnings.forEach(warn => {
      stmt.run(
        warn.id, warn.greenhouse_id, warn.warning_no, warn.disease_type,
        warn.severity_level, warn.affected_area, warn.detected_date, warn.reporter,
        warn.status, warn.description, warn.temperature, warn.humidity,
        warn.ph_value, warn.fertilizer_used, warn.pesticide_applied, warn.version,
        (err) => {
          if (err) return reject(err);
          completed++;
          if (completed === diseaseWarnings.length) {
            stmt.finalize();
            resolve();
          }
        }
      );
    });
  });
}

function insertHistory(db) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO warning_history 
      (warning_id, field_changed, old_value, new_value, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    let completed = 0;
    warningHistory.forEach(hist => {
      stmt.run(hist.warning_id, hist.field_changed, hist.old_value, hist.new_value, hist.changed_by, (err) => {
        if (err) return reject(err);
        completed++;
        if (completed === warningHistory.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

async function initData() {
  const db = new sqlite3.Database(dbPath);
  
  try {
    await createTables(db);
    await insertGreenhouses(db);
    await insertWarnings(db);
    await insertHistory(db);
    
    console.log('初始化数据完成！');
    console.log('温室数量:', greenhouses.length);
    console.log('预警记录数量:', diseaseWarnings.length);
    console.log('历史变更记录数量:', warningHistory.length);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  initData().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('初始化数据失败:', err);
    process.exit(1);
  });
}

module.exports = { initData, greenhouses, diseaseWarnings };