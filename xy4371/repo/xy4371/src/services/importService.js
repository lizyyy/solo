const fs = require('fs');
const csv = require('csv-parser');
const { runAsync, allAsync } = require('../config/database');

async function importContainers(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const row of results) {
            const containerId = row.container_id || row.箱体编号;
            const containerType = row.container_type || row.箱体类型 || 'standard';
            const isSpare = row.is_spare || row.是否备用 || 0;
            const status = row.status || row.状态 || 'active';

            if (containerId) {
              await runAsync(`
                INSERT OR REPLACE INTO containers (container_id, container_type, is_spare, status)
                VALUES (?, ?, ?, ?)
              `, [containerId, containerType, parseInt(isSpare) || 0, status]);
              imported++;
            }
          }
          resolve({ imported, total: results.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importIcePacks(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const row of results) {
            const packId = row.pack_id || row.冰排编号;
            const containerId = row.container_id || row.所属箱体;
            const frozenStatus = row.frozen_status || row.冻结状态 || 'frozen';
            const status = row.status || row.状态 || 'active';

            if (packId) {
              await runAsync(`
                INSERT OR REPLACE INTO ice_packs (pack_id, container_id, frozen_status, status)
                VALUES (?, ?, ?, ?)
              `, [packId, containerId || null, frozenStatus, status]);
              imported++;
            }
          }
          resolve({ imported, total: results.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importTemperatureLoggers(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const row of results) {
            const loggerId = row.logger_id || row.记录仪编号;
            const containerId = row.container_id || row.所属箱体;
            const status = row.status || row.状态 || 'active';

            if (loggerId) {
              await runAsync(`
                INSERT OR REPLACE INTO temperature_loggers (logger_id, container_id, status)
                VALUES (?, ?, ?)
              `, [loggerId, containerId || null, status]);
              imported++;
            }
          }
          resolve({ imported, total: results.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importBatches(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const row of results) {
            const batchNumber = row.batch_number || row.批号;
            const vaccineName = row.vaccine_name || row.疫苗名称;
            const expectedContainerId = row.expected_container_id || row.预计箱体;
            const quantity = row.quantity || row.数量 || 0;
            const appointmentDate = row.appointment_date || row.预约日期;

            if (batchNumber && vaccineName) {
              await runAsync(`
                INSERT OR REPLACE INTO appointment_batches 
                (batch_number, vaccine_name, expected_container_id, quantity, appointment_date)
                VALUES (?, ?, ?, ?, ?)
              `, [batchNumber, vaccineName, expectedContainerId || null, parseInt(quantity) || 0, appointmentDate]);
              
              if (expectedContainerId) {
                await runAsync(`
                  INSERT OR REPLACE INTO batch_assignments (batch_number, container_id, assignment_date)
                  VALUES (?, ?, ?)
                `, [batchNumber, expectedContainerId, appointmentDate]);
              }
              imported++;
            }
          }
          resolve({ imported, total: results.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importTemperatureRecords(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          for (const row of results) {
            const loggerId = row.logger_id || row.记录仪编号;
            const containerId = row.container_id || row.箱体编号;
            const recordTime = row.record_time || row.记录时间;
            const temperature = row.temperature || row.温度;

            if (loggerId && recordTime && temperature !== undefined) {
              await runAsync(`
                INSERT INTO temperature_records (logger_id, container_id, record_time, temperature)
                VALUES (?, ?, ?, ?)
              `, [loggerId, containerId || null, recordTime, parseFloat(temperature)]);
              imported++;
            }
          }
          resolve({ imported, total: results.length });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importCalibration(data) {
  try {
    let imported = 0;
    const records = Array.isArray(data) ? data : [data];
    
    for (const record of records) {
      const deviceId = record.device_id || record.设备编号;
      const deviceType = record.device_type || record.设备类型;
      const calibrationDate = record.calibration_date || record.校准日期;
      const expireDate = record.expire_date || record.到期日期;
      const certificateNumber = record.certificate_number || record.证书编号;
      const calibrationAgency = record.calibration_agency || record.校准机构;

      if (deviceId && calibrationDate && expireDate) {
        await runAsync(`
          INSERT OR REPLACE INTO calibration_records 
          (device_id, device_type, calibration_date, expire_date, certificate_number, calibration_agency)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [deviceId, deviceType || 'unknown', calibrationDate, expireDate, certificateNumber || null, calibrationAgency || null]);
        imported++;
      }
    }
    return { imported, total: records.length };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  importContainers,
  importIcePacks,
  importTemperatureLoggers,
  importBatches,
  importTemperatureRecords,
  importCalibration
};
