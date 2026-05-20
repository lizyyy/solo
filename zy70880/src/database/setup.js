const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(__dirname, '../../data/cold_storage.db');
const db = new sqlite3.Database(dbPath);

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status TEXT DEFAULT 'pending',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meter_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        zone_id INTEGER,
        multiplier REAL DEFAULT 1,
        multiplier_changed BOOLEAN DEFAULT 0,
        last_multiplier REAL,
        multiplier_change_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_id) REFERENCES temperature_zones(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS meter_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        meter_id INTEGER NOT NULL,
        reading_date DATE NOT NULL,
        reading_value REAL NOT NULL,
        consumption REAL,
        multiplier REAL DEFAULT 1,
        actual_consumption REAL,
        is_peak_abnormal BOOLEAN DEFAULT 0,
        peak_reason TEXT,
        is_vacant_period BOOLEAN DEFAULT 0,
        vacant_reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (meter_id) REFERENCES meters(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS temperature_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        temperature_range TEXT,
        area REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        contact_person TEXT,
        contact_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_no TEXT UNIQUE NOT NULL,
        tenant_id INTEGER NOT NULL,
        zone_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        allocation_ratio REAL NOT NULL,
        electricity_price REAL NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (zone_id) REFERENCES temperature_zones(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        processed_by TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        FOREIGN KEY (reading_id) REFERENCES meter_readings(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS allocation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        contract_id INTEGER NOT NULL,
        reading_id INTEGER NOT NULL,
        allocated_consumption REAL NOT NULL,
        allocated_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (reading_id) REFERENCES meter_readings(id)
      )`, (err) => {
        if (err) reject(err);
        else {
          console.log('所有表创建成功');
          resolve();
        }
      });
    });
  });
};

const seedZones = async () => {
  const zonesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../examples/zones.json'), 'utf8'));
  
  for (const zone of zonesData) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO temperature_zones (zone_code, name, temperature_range, area)
        VALUES (?, ?, ?, ?)
      `, [zone.zone_code, zone.name, zone.temperature_range, zone.area], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log('温区数据初始化完成');
};

const seedTenants = async () => {
  const contractsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../examples/contracts.json'), 'utf8'));
  const tenants = new Map();
  
  for (const contract of contractsData) {
    if (!tenants.has(contract.tenant_code)) {
      tenants.set(contract.tenant_code, contract);
    }
  }
  
  for (const [tenantCode, data] of tenants) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO tenants (tenant_code, name)
        VALUES (?, ?)
      `, [tenantCode, data.tenant_name], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log('租户数据初始化完成');
};

const seedContracts = async () => {
  const contractsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../examples/contracts.json'), 'utf8'));
  
  for (const contract of contractsData) {
    const tenantId = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM tenants WHERE tenant_code = ?', [contract.tenant_code], (err, row) => {
        if (err) reject(err);
        else resolve(row.id);
      });
    });
    
    const zoneId = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM temperature_zones WHERE zone_code = ?', [contract.zone_code], (err, row) => {
        if (err) reject(err);
        else resolve(row.id);
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO contracts 
        (contract_no, tenant_id, zone_id, start_date, end_date, allocation_ratio, electricity_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        contract.contract_no,
        tenantId,
        zoneId,
        contract.start_date,
        contract.end_date,
        contract.allocation_ratio,
        contract.electricity_price,
        contract.status
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log('合同数据初始化完成');
};

const seedMeters = async () => {
  const meters = [
    { meter_no: 'METER-A01', name: '低温A区总表', zone_code: 'ZONE-001', multiplier: 20 },
    { meter_no: 'METER-B01', name: '中温B区总表', zone_code: 'ZONE-002', multiplier: 15 },
    { meter_no: 'METER-C01', name: '超低温C区总表', zone_code: 'ZONE-003', multiplier: 30 }
  ];
  
  for (const meter of meters) {
    const zoneId = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM temperature_zones WHERE zone_code = ?', [meter.zone_code], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.id : null);
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO meters (meter_no, name, zone_id, multiplier)
        VALUES (?, ?, ?, ?)
      `, [meter.meter_no, meter.name, zoneId, meter.multiplier], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log('电表数据初始化完成');
};

const seedBatch = async () => {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO batches (batch_no, name, period_start, period_end, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['BATCH-202405', '2024年5月电费结算', '2024-05-01', '2024-05-31', '财务-张姐', 'pending'], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const seedReadings = async (batchId) => {
  const csvContent = fs.readFileSync(path.join(__dirname, '../../examples/meter_readings.csv'), 'utf8');
  const lines = csvContent.split('\n').slice(1);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const [meterNo, meterName, readingDate, readingValue, consumption, multiplier] = line.split(',');
    
    const meterId = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM meters WHERE meter_no = ?', [meterNo], (err, row) => {
        if (err) reject(err);
        else resolve(row.id);
      });
    });
    
    const cons = parseFloat(consumption);
    const mult = parseFloat(multiplier);
    const actualCons = cons * mult;
    const isPeakAbnormal = cons > 10000 ? 1 : 0;
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO meter_readings 
        (batch_id, meter_id, reading_date, reading_value, consumption, multiplier, actual_consumption, is_peak_abnormal, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        batchId,
        meterId,
        readingDate,
        parseFloat(readingValue),
        cons,
        mult,
        actualCons,
        isPeakAbnormal,
        isPeakAbnormal ? 'needs_review' : 'pending'
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log('电表读数初始化完成');
};

const addProcessingExample = async () => {
  const reading = await new Promise((resolve, reject) => {
    db.get(`
      SELECT id FROM meter_readings WHERE is_peak_abnormal = 1 LIMIT 1
    `, [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (reading) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO processing_records (reading_id, action, reason, processed_by, remarks)
        VALUES (?, ?, ?, ?, ?)
      `, [
        reading.id,
        'manual_fix',
        '抄表员录入错误，实际用电量应为820度，读数时多打了一个0',
        '财务-张姐',
        '已核实原始抄表记录，修正后数据正确'
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE meter_readings 
        SET status = 'fixed', consumption = 820, actual_consumption = 16400, peak_reason = '录入错误，已修正'
        WHERE id = ?
      `, [reading.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('人工修正示例数据已添加');
  }
};

const setupAll = async () => {
  try {
    await createTables();
    await seedZones();
    await seedTenants();
    await seedContracts();
    await seedMeters();
    const batchId = await seedBatch();
    console.log('批次创建完成，ID:', batchId);
    await seedReadings(batchId);
    await addProcessingExample();
    
    console.log('数据库初始化和示例数据导入完成！');
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('初始化失败:', err);
    db.close();
    process.exit(1);
  }
};

setupAll();
