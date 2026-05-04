const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'kiln.db');
const DATA_DIR = path.join(__dirname, '..', 'data');

let db = null;

async function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createTables();
    insertSeedData();
    saveDatabase();
  }

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS kilns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      power REAL NOT NULL,
      capacity REAL NOT NULL,
      max_temperature REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bodies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_heating_rate REAL NOT NULL,
      max_cooling_rate REAL NOT NULL,
      min_hold_time REAL NOT NULL,
      safe_heating_rate_for_thick REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS glazes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      min_firing_temp REAL NOT NULL,
      max_firing_temp REAL NOT NULL,
      optimal_firing_temp REAL NOT NULL,
      hold_time_required REAL NOT NULL,
      cooling_sensitivity TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pieces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body_id TEXT NOT NULL,
      glaze_id TEXT,
      thickness REAL NOT NULL,
      weight REAL NOT NULL,
      type TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_id) REFERENCES bodies(id),
      FOREIGN KEY (glaze_id) REFERENCES glazes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS firing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kiln_id TEXT NOT NULL,
      electricity_price REAL NOT NULL,
      expected_max_duration REAL,
      expected_max_cost REAL,
      total_pieces_weight REAL DEFAULT 0,
      estimated_duration REAL,
      estimated_cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kiln_id) REFERENCES kilns(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS firing_curve_stages (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      stage_order INTEGER NOT NULL,
      stage_type TEXT NOT NULL,
      start_temp REAL NOT NULL,
      target_temp REAL,
      heating_rate REAL,
      cooling_rate REAL,
      hold_duration REAL,
      estimated_duration REAL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES firing_plans(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plan_pieces (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      piece_id TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES firing_plans(id),
      FOREIGN KEY (piece_id) REFERENCES pieces(id),
      UNIQUE(plan_id, piece_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_checks (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      piece_id TEXT,
      risk_type TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES firing_plans(id),
      FOREIGN KEY (piece_id) REFERENCES pieces(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS firing_records (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      actual_start_time DATETIME,
      actual_end_time DATETIME,
      actual_duration REAL,
      actual_cost REAL,
      had_cracks BOOLEAN DEFAULT 0,
      glaze_matured BOOLEAN,
      issues TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES firing_plans(id)
    )
  `);
}

function insertSeedData() {
  const { v4: uuidv4 } = require('uuid');

  const kilns = [
    {
      id: uuidv4(),
      name: '小电窑 A型',
      power: 6.0,
      capacity: 0.05,
      max_temperature: 1300,
      description: '工作室主力小电窑，功率6kW，容积50升'
    },
    {
      id: uuidv4(),
      name: '中电窑 B型',
      power: 9.0,
      capacity: 0.1,
      max_temperature: 1320,
      description: '中型电窑，功率9kW，容积100升'
    }
  ];

  const bodies = [
    {
      id: uuidv4(),
      name: '普通陶泥',
      max_heating_rate: 300,
      max_cooling_rate: 200,
      min_hold_time: 0.5,
      safe_heating_rate_for_thick: 150,
      description: '适合新手的普通陶泥'
    },
    {
      id: uuidv4(),
      name: '高铝瓷泥',
      max_heating_rate: 200,
      max_cooling_rate: 150,
      min_hold_time: 1.0,
      safe_heating_rate_for_thick: 100,
      description: '高铝含量，烧成温度高，需要更慢的升温和降温'
    },
    {
      id: uuidv4(),
      name: '炻器泥',
      max_heating_rate: 250,
      max_cooling_rate: 180,
      min_hold_time: 0.75,
      safe_heating_rate_for_thick: 120,
      description: '炻器泥，适合中温烧成'
    }
  ];

  const glazes = [
    {
      id: uuidv4(),
      name: '透明釉(中温)',
      min_firing_temp: 1220,
      max_firing_temp: 1260,
      optimal_firing_temp: 1240,
      hold_time_required: 0.5,
      cooling_sensitivity: 'low',
      description: '基础透明釉，中温烧成'
    },
    {
      id: uuidv4(),
      name: '青瓷釉',
      min_firing_temp: 1230,
      max_firing_temp: 1270,
      optimal_firing_temp: 1250,
      hold_time_required: 0.75,
      cooling_sensitivity: 'medium',
      description: '青瓷釉，需要适当的还原气氛和保温'
    },
    {
      id: uuidv4(),
      name: '铜红釉',
      min_firing_temp: 1250,
      max_firing_temp: 1280,
      optimal_firing_temp: 1265,
      hold_time_required: 1.0,
      cooling_sensitivity: 'high',
      description: '铜红釉，对温度和气氛敏感，需要精确控温和缓慢降温'
    },
    {
      id: uuidv4(),
      name: '哑光釉',
      min_firing_temp: 1200,
      max_firing_temp: 1240,
      optimal_firing_temp: 1220,
      hold_time_required: 0.5,
      cooling_sensitivity: 'low',
      description: '哑光釉，较低温度即可成熟'
    }
  ];

  const pieces = [
    {
      id: uuidv4(),
      name: '茶杯 - 新手作品',
      body_id: bodies[0].id,
      glaze_id: glazes[0].id,
      thickness: 0.5,
      weight: 0.3,
      type: 'cup',
      notes: '新手第一次拉坯，壁稍厚'
    },
    {
      id: uuidv4(),
      name: '小盘子',
      body_id: bodies[0].id,
      glaze_id: glazes[1].id,
      thickness: 0.4,
      weight: 0.4,
      type: 'plate',
      notes: '修坯较好'
    },
    {
      id: uuidv4(),
      name: '雕塑摆件',
      body_id: bodies[1].id,
      glaze_id: glazes[2].id,
      thickness: 1.5,
      weight: 1.2,
      type: 'sculpture',
      notes: '厚壁雕塑，高铝瓷泥'
    },
    {
      id: uuidv4(),
      name: '马克杯',
      body_id: bodies[2].id,
      glaze_id: glazes[3].id,
      thickness: 0.6,
      weight: 0.5,
      type: 'mug',
      notes: '炻器泥，哑光釉'
    }
  ];

  for (const kiln of kilns) {
    db.run(
      'INSERT INTO kilns (id, name, power, capacity, max_temperature, description) VALUES (?, ?, ?, ?, ?, ?)',
      [kiln.id, kiln.name, kiln.power, kiln.capacity, kiln.max_temperature, kiln.description]
    );
  }

  for (const body of bodies) {
    db.run(
      'INSERT INTO bodies (id, name, max_heating_rate, max_cooling_rate, min_hold_time, safe_heating_rate_for_thick, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [body.id, body.name, body.max_heating_rate, body.max_cooling_rate, body.min_hold_time, body.safe_heating_rate_for_thick, body.description]
    );
  }

  for (const glaze of glazes) {
    db.run(
      'INSERT INTO glazes (id, name, min_firing_temp, max_firing_temp, optimal_firing_temp, hold_time_required, cooling_sensitivity, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [glaze.id, glaze.name, glaze.min_firing_temp, glaze.max_firing_temp, glaze.optimal_firing_temp, glaze.hold_time_required, glaze.cooling_sensitivity, glaze.description]
    );
  }

  for (const piece of pieces) {
    db.run(
      'INSERT INTO pieces (id, name, body_id, glaze_id, thickness, weight, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [piece.id, piece.name, piece.body_id, piece.glaze_id, piece.thickness, piece.weight, piece.type, piece.notes]
    );
  }
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  closeDatabase
};
