const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/cold_storage.db');
const db = new sqlite3.Database(dbPath);

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

const seedAll = async () => {
  try {
    await seedZones();
    await seedTenants();
    await seedContracts();
    await seedMeters();
    const batchId = await seedBatch();
    console.log('批次创建完成，ID:', batchId);
    await seedReadings(batchId);
    await addProcessingExample();
    
    console.log('所有示例数据初始化完成！');
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('初始化示例数据失败:', err);
    db.close();
    process.exit(1);
  }
};

seedAll();
