const db = require('../config/database');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');

const importMeterCSV = async (filePath, batchId) => {
  return new Promise((resolve, reject) => {
    const readings = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        readings.push(row);
      })
      .on('end', async () => {
        try {
          await processMeterReadings(readings, batchId);
          resolve({ success: true, count: readings.length });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
};

const processMeterReadings = async (readings, batchId) => {
  const stmt = db.prepare(`
    INSERT INTO meter_readings 
    (batch_id, meter_id, reading_date, reading_value, consumption, multiplier, actual_consumption, is_peak_abnormal, is_vacant_period, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const reading of readings) {
    const meter = await findOrCreateMeter(reading.meter_no, reading.meter_name || reading.meter_no);
    
    const consumption = parseFloat(reading.consumption || reading.reading_value || 0);
    const multiplier = parseFloat(reading.multiplier || 1);
    const actualConsumption = consumption * multiplier;
    
    const isPeakAbnormal = detectAbnormalPeak(consumption);
    const isVacantPeriod = await checkVacantPeriod(meter.id, reading.reading_date);

    stmt.run(
      batchId,
      meter.id,
      reading.reading_date,
      parseFloat(reading.reading_value || 0),
      consumption,
      multiplier,
      actualConsumption,
      isPeakAbnormal ? 1 : 0,
      isVacantPeriod ? 1 : 0,
      isPeakAbnormal || isVacantPeriod ? 'needs_review' : 'pending'
    );
  }

  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const findOrCreateMeter = (meterNo, meterName) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM meters WHERE meter_no = ?', [meterNo], (err, row) => {
      if (err) reject(err);
      if (row) {
        resolve(row);
      } else {
        db.run(
          'INSERT INTO meters (meter_no, name) VALUES (?, ?)',
          [meterNo, meterName],
          function(err) {
            if (err) reject(err);
            resolve({ id: this.lastID });
          }
        );
      }
    });
  });
};

const detectAbnormalPeak = (consumption) => {
  return consumption > 10000;
};

const checkVacantPeriod = async (meterId, readingDate) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 1 FROM meters m
      LEFT JOIN temperature_zones z ON m.zone_id = z.id
      LEFT JOIN contracts c ON z.id = c.zone_id
      WHERE m.id = ? 
      AND ? NOT BETWEEN c.start_date AND c.end_date
      LIMIT 1
    `, [meterId, readingDate], (err, row) => {
      if (err) reject(err);
      resolve(!!row);
    });
  });
};

const importContractJSON = async (filePath) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const contract of data.contracts || data) {
    const tenant = await findOrCreateTenant(contract.tenant_code, contract.tenant_name);
    const zone = await findOrCreateZone(contract.zone_code, contract.zone_name);
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO contracts 
        (contract_no, tenant_id, zone_id, start_date, end_date, allocation_ratio, electricity_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        contract.contract_no,
        tenant.id,
        zone.id,
        contract.start_date,
        contract.end_date,
        parseFloat(contract.allocation_ratio),
        parseFloat(contract.electricity_price),
        contract.status || 'active'
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  return { success: true };
};

const findOrCreateTenant = (tenantCode, tenantName) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM tenants WHERE tenant_code = ?', [tenantCode], (err, row) => {
      if (err) reject(err);
      if (row) {
        resolve(row);
      } else {
        db.run(
          'INSERT INTO tenants (tenant_code, name) VALUES (?, ?)',
          [tenantCode, tenantName],
          function(err) {
            if (err) reject(err);
            resolve({ id: this.lastID });
          }
        );
      }
    });
  });
};

const findOrCreateZone = (zoneCode, zoneName) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM temperature_zones WHERE zone_code = ?', [zoneCode], (err, row) => {
      if (err) reject(err);
      if (row) {
        resolve(row);
      } else {
        db.run(
          'INSERT INTO temperature_zones (zone_code, name) VALUES (?, ?)',
          [zoneCode, zoneName],
          function(err) {
            if (err) reject(err);
            resolve({ id: this.lastID });
          }
        );
      }
    });
  });
};

const importTemperatureZones = async (zonesData) => {
  for (const zone of zonesData) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO temperature_zones 
        (zone_code, name, temperature_range, area)
        VALUES (?, ?, ?, ?)
      `, [
        zone.zone_code,
        zone.name,
        zone.temperature_range,
        parseFloat(zone.area || 0)
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  return { success: true };
};

module.exports = {
  importMeterCSV,
  importContractJSON,
  importTemperatureZones,
  findOrCreateMeter,
  findOrCreateTenant,
  findOrCreateZone
};
