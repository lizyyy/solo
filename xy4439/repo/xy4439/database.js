const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

const DB_PATH = './data/welding_shop.db';
const DB_DIR = './data';
const UPLOADS_DIR = './uploads';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.createTables();
    }
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, shift_type)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS welding_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        station_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_seconds INTEGER,
        employee_name TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS exhaust_sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        station_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        smoke_level REAL,
        exhaust_flow REAL,
        is_exhaust_active BOOLEAN,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS employee_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        employee_name TEXT NOT NULL,
        station_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS helmet_inspection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        employee_name TEXT NOT NULL,
        inspection_time DATETIME NOT NULL,
        is_helmet_provided BOOLEAN,
        is_filter_valid BOOLEAN,
        inspection_result TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS risks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        risk_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        station_id TEXT,
        employee_name TEXT,
        start_time DATETIME,
        end_time DATETIME,
        duration_seconds INTEGER,
        smoke_level REAL,
        exhaust_flow REAL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS risk_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        risk_id INTEGER NOT NULL,
        reviewer TEXT,
        comment TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (risk_id) REFERENCES risks(id)
      )
    `);

    this.save();
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  getOrCreateShift(date, shiftType) {
    let result = this.db.exec('SELECT id FROM shifts WHERE date = ? AND shift_type = ?', [date, shiftType]);
    
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    
    this.db.run('INSERT INTO shifts (date, shift_type) VALUES (?, ?)', [date, shiftType]);
    this.save();
    return this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  }

  getAllShifts() {
    const result = this.db.exec(`
      SELECT id, date, shift_type, created_at 
      FROM shifts 
      ORDER BY date DESC, 
        CASE shift_type 
          WHEN '早班' THEN 1 
          WHEN '中班' THEN 2 
          WHEN '晚班' THEN 3 
        END
    `);
    
    if (result.length === 0) return [];
    
    return result[0].values.map(row => ({
      id: row[0],
      date: row[1],
      shift_type: row[2],
      created_at: row[3]
    }));
  }

  getShiftWithDetails(date, shiftType) {
    const shiftResult = this.db.exec(
      'SELECT id, date, shift_type FROM shifts WHERE date = ? AND shift_type = ?',
      [date, shiftType]
    );
    
    if (shiftResult.length === 0 || shiftResult[0].values.length === 0) {
      return null;
    }

    const shiftId = shiftResult[0].values[0][0];
    
    const weldingRecords = this.db.exec(
      'SELECT * FROM welding_records WHERE shift_id = ?',
      [shiftId]
    );
    
    const exhaustData = this.db.exec(
      'SELECT * FROM exhaust_sensor_data WHERE shift_id = ?',
      [shiftId]
    );
    
    const schedule = this.db.exec(
      'SELECT * FROM employee_schedule WHERE shift_id = ?',
      [shiftId]
    );
    
    const inspections = this.db.exec(
      'SELECT * FROM helmet_inspection WHERE shift_id = ?',
      [shiftId]
    );

    return {
      shift: {
        id: shiftResult[0].values[0][0],
        date: shiftResult[0].values[0][1],
        shift_type: shiftResult[0].values[0][2]
      },
      welding_records: this.mapResult(weldingRecords),
      exhaust_sensor_data: this.mapResult(exhaustData),
      employee_schedule: this.mapResult(schedule),
      helmet_inspections: this.mapResult(inspections)
    };
  }

  mapResult(result) {
    if (result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  importWeldingRecords(records, date, shiftType) {
    const shiftId = this.getOrCreateShift(date, shiftType);
    let count = 0;

    records.forEach(record => {
      const stationId = record['工位'] || record['station_id'] || record['工位ID'];
      const startTime = record['开始时间'] || record['start_time'];
      const endTime = record['结束时间'] || record['end_time'];
      const employeeName = record['员工姓名'] || record['employee_name'];
      
      let durationSeconds = null;
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        durationSeconds = Math.floor((end - start) / 1000);
      }

      this.db.run(`
        INSERT INTO welding_records 
        (shift_id, station_id, start_time, end_time, duration_seconds, employee_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [shiftId, stationId, startTime, endTime, durationSeconds, employeeName]);
      count++;
    });

    this.save();
    return count;
  }

  importExhaustSensorData(data, date, shiftType) {
    const shiftId = this.getOrCreateShift(date, shiftType);
    let count = 0;

    data.forEach(record => {
      const stationId = record['工位'] || record['station_id'] || record['工位ID'];
      const timestamp = record['时间'] || record['timestamp'];
      const smokeLevel = parseFloat(record['烟尘浓度'] || record['smoke_level'] || 0);
      const exhaustFlow = parseFloat(record['排风流量'] || record['exhaust_flow'] || 0);
      const isActive = (record['排风状态'] || record['is_exhaust_active']) === '开启' || 
                       (record['排风状态'] || record['is_exhaust_active']) === true ||
                       (record['排风状态'] || record['is_exhaust_active']) === 1;

      this.db.run(`
        INSERT INTO exhaust_sensor_data 
        (shift_id, station_id, timestamp, smoke_level, exhaust_flow, is_exhaust_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [shiftId, stationId, timestamp, smokeLevel, exhaustFlow, isActive ? 1 : 0]);
      count++;
    });

    this.save();
    return count;
  }

  importEmployeeSchedule(schedule, date, shiftType) {
    const shiftId = this.getOrCreateShift(date, shiftType);
    let count = 0;

    schedule.forEach(record => {
      const employeeName = record['员工姓名'] || record['employee_name'];
      const stationId = record['工位'] || record['station_id'] || record['工位ID'];
      const startTime = record['开始时间'] || record['start_time'];
      const endTime = record['结束时间'] || record['end_time'];

      this.db.run(`
        INSERT INTO employee_schedule 
        (shift_id, employee_name, station_id, start_time, end_time)
        VALUES (?, ?, ?, ?, ?)
      `, [shiftId, employeeName, stationId, startTime, endTime]);
      count++;
    });

    this.save();
    return count;
  }

  importHelmetInspection(inspections, date, shiftType) {
    const shiftId = this.getOrCreateShift(date, shiftType);
    let count = 0;

    inspections.forEach(record => {
      const employeeName = record['员工姓名'] || record['employee_name'];
      const inspectionTime = record['点检时间'] || record['inspection_time'];
      const isHelmetProvided = (record['面罩配备'] || record['is_helmet_provided']) === '是' ||
                                (record['面罩配备'] || record['is_helmet_provided']) === true ||
                                (record['面罩配备'] || record['is_helmet_provided']) === 1;
      const isFilterValid = (record['滤片有效'] || record['is_filter_valid']) === '是' ||
                            (record['滤片有效'] || record['is_filter_valid']) === true ||
                            (record['滤片有效'] || record['is_filter_valid']) === 1;
      const result = record['点检结果'] || record['inspection_result'];

      this.db.run(`
        INSERT INTO helmet_inspection 
        (shift_id, employee_name, inspection_time, is_helmet_provided, is_filter_valid, inspection_result)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [shiftId, employeeName, inspectionTime, isHelmetProvided ? 1 : 0, isFilterValid ? 1 : 0, result]);
      count++;
    });

    this.save();
    return count;
  }

  addRisk(shiftId, riskType, riskLevel, stationId, employeeName, startTime, endTime, description, smokeLevel = null, exhaustFlow = null) {
    let durationSeconds = null;
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      durationSeconds = Math.floor((end - start) / 1000);
    }

    this.db.run(`
      INSERT INTO risks 
      (shift_id, risk_type, risk_level, station_id, employee_name, start_time, end_time, duration_seconds, smoke_level, exhaust_flow, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [shiftId, riskType, riskLevel, stationId, employeeName, startTime, endTime, durationSeconds, smokeLevel, exhaustFlow, description]);

    this.save();
    return this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  }

  getRisksForShift(shiftId) {
    const result = this.db.exec(`
      SELECT r.*, 
             (SELECT comment FROM risk_reviews WHERE risk_id = r.id ORDER BY reviewed_at DESC LIMIT 1) as latest_comment,
             (SELECT status FROM risk_reviews WHERE risk_id = r.id ORDER BY reviewed_at DESC LIMIT 1) as review_status
      FROM risks r
      WHERE r.shift_id = ?
      ORDER BY 
        CASE r.risk_level 
          WHEN '红色' THEN 1 
          WHEN '黄色' THEN 2 
          WHEN '绿色' THEN 3 
        END,
        r.start_time
    `, [shiftId]);

    return this.mapResult(result);
  }

  addRiskReview(riskId, reviewer, comment, status = 'pending') {
    this.db.run(`
      INSERT INTO risk_reviews (risk_id, reviewer, comment, status)
      VALUES (?, ?, ?, ?)
    `, [riskId, reviewer, comment, status]);

    this.save();
    return this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  }

  getRiskReviews(riskId) {
    const result = this.db.exec(`
      SELECT * FROM risk_reviews WHERE risk_id = ? ORDER BY reviewed_at DESC
    `, [riskId]);

    return this.mapResult(result);
  }

  getWeldingRecordsForShift(shiftId) {
    const result = this.db.exec('SELECT * FROM welding_records WHERE shift_id = ? ORDER BY start_time', [shiftId]);
    return this.mapResult(result);
  }

  getExhaustDataForShift(shiftId) {
    const result = this.db.exec('SELECT * FROM exhaust_sensor_data WHERE shift_id = ? ORDER BY timestamp', [shiftId]);
    return this.mapResult(result);
  }

  getEmployeeScheduleForShift(shiftId) {
    const result = this.db.exec('SELECT * FROM employee_schedule WHERE shift_id = ?', [shiftId]);
    return this.mapResult(result);
  }

  getHelmetInspectionsForShift(shiftId) {
    const result = this.db.exec('SELECT * FROM helmet_inspection WHERE shift_id = ?', [shiftId]);
    return this.mapResult(result);
  }
}

module.exports = { DatabaseManager };
