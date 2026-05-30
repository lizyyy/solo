import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data', 'solarcar.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables(db)
    seedIfEmpty(db)
  }
  return db
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS light_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      time_slot TEXT NOT NULL,
      intensity_wm2 REAL NOT NULL,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS track_params (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      slope_percent REAL NOT NULL DEFAULT 0,
      slope_direction TEXT NOT NULL CHECK(slope_direction IN ('uphill','downhill','flat')),
      gear_ratio REAL NOT NULL DEFAULT 1,
      track_length_m REAL NOT NULL DEFAULT 10,
      surface_type TEXT DEFAULT 'smooth',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS car_params (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      car_name TEXT NOT NULL DEFAULT '默认小车',
      mass_kg REAL NOT NULL DEFAULT 0.5,
      motor_voltage_v REAL NOT NULL DEFAULT 6,
      motor_rpm REAL NOT NULL DEFAULT 3000,
      motor_power_w REAL NOT NULL DEFAULT 2,
      motor_efficiency_percent REAL NOT NULL DEFAULT 60,
      panel_area_m2 REAL NOT NULL DEFAULT 0.03,
      panel_efficiency_percent REAL NOT NULL DEFAULT 20,
      wheel_diameter_m REAL NOT NULL DEFAULT 0.06,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estimation_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      car_params_id TEXT NOT NULL REFERENCES car_params(id),
      track_params_id TEXT NOT NULL REFERENCES track_params(id),
      light_record_ids TEXT NOT NULL DEFAULT '[]',
      available_power_w REAL NOT NULL DEFAULT 0,
      slope_resistance_n REAL NOT NULL DEFAULT 0,
      rolling_resistance_n REAL NOT NULL DEFAULT 0,
      aero_resistance_n REAL NOT NULL DEFAULT 0,
      total_resistance_n REAL NOT NULL DEFAULT 0,
      net_force_n REAL NOT NULL DEFAULT 0,
      estimated_time_s REAL NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('confirmed','pending')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_light_records_project ON light_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_track_params_project ON track_params(project_id);
    CREATE INDEX IF NOT EXISTS idx_car_params_project ON car_params(project_id);
    CREATE INDEX IF NOT EXISTS idx_estimation_project ON estimation_reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_estimation_status ON estimation_reports(status);
  `)
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c
  if (count > 0) return

  const insertProject = db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
  const insertLight = db.prepare('INSERT INTO light_records (id, project_id, time_slot, intensity_wm2, source) VALUES (?, ?, ?, ?, ?)')
  const insertTrack = db.prepare('INSERT INTO track_params (id, project_id, slope_percent, slope_direction, gear_ratio, track_length_m, surface_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertCar = db.prepare('INSERT INTO car_params (id, project_id, car_name, mass_kg, motor_voltage_v, motor_rpm, motor_power_w, motor_efficiency_percent, panel_area_m2, panel_efficiency_percent, wheel_diameter_m) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

  insertProject.run('proj-normal', '正常示例项目', '典型参数组合，光照充足、坡度合理、齿轮比正常')
  insertProject.run('proj-edge', '边界样例项目（易出错）', '极端参数：光照极低、坡度反、齿轮比越界、电机效率差')

  insertLight.run('lr-n1', 'proj-normal', '08:00-09:00', 850, 'manual')
  insertLight.run('lr-n2', 'proj-normal', '09:00-10:00', 920, 'manual')
  insertLight.run('lr-n3', 'proj-normal', '10:00-11:00', 980, 'manual')
  insertLight.run('lr-n4', 'proj-normal', '11:00-12:00', 1000, 'manual')

  insertLight.run('lr-e1', 'proj-edge', '08:00-09:00', 50, 'manual')
  insertLight.run('lr-e2', 'proj-edge', '09:00-10:00', 30, 'manual')
  insertLight.run('lr-e3', 'proj-edge', '10:00-11:00', 45, 'manual')
  insertLight.run('lr-e4', 'proj-edge', '11:00-12:00', 60, 'manual')

  insertTrack.run('tp-n1', 'proj-normal', 3, 'uphill', 3, 10, 'smooth')
  insertTrack.run('tp-e1', 'proj-edge', 15, 'uphill', 12, 10, 'rough')

  insertCar.run('cp-n1', 'proj-normal', '正常小车', 0.5, 6, 3000, 2, 60, 0.03, 20, 0.06)
  insertCar.run('cp-e1', 'proj-edge', '问题小车', 2, 6, 3000, 2, 30, 0.03, 20, 0.06)
}
