const fs = require('fs');
const csv = require('csv-parser');
const db = require('../config/database');
const ErrorHandler = require('../utils/errorHandler');

class ImportService {
  static async importStopsFromCSV(filePath) {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (data) => {
          rowNumber++;
          
          const normalizedData = {
            stop_id: data.stop_id || data['站点ID'] || data.id,
            stop_name: data.stop_name || data['站点名称'] || data.name,
            route_id: data.route_id || data['线路ID'] || data.route,
            scheduled_time: data.scheduled_time || data['计划时间'] || data.time,
            sequence: parseInt(data.sequence || data['序号'] || data.seq || 0)
          };

          const validation = ErrorHandler.validateStopData(normalizedData, rowNumber);
          
          if (!validation.valid) {
            const errorRecord = await ErrorHandler.recordImportError(
              'stops',
              data,
              rowNumber,
              validation.errors,
              validation.suggestion
            );
            errors.push({ row: rowNumber, error: validation.errors, ...errorRecord });
            return;
          }

          try {
            await new Promise((res, rej) => {
              db.run(
                `INSERT OR REPLACE INTO stops (stop_id, stop_name, route_id, scheduled_time, sequence)
                 VALUES (?, ?, ?, ?, ?)`,
                [normalizedData.stop_id, normalizedData.stop_name, normalizedData.route_id, 
                 normalizedData.scheduled_time, normalizedData.sequence],
                function(err) {
                  if (err) rej(err);
                  else res({ id: this.lastID });
                }
              );
            });
            results.push({ row: rowNumber, stop_id: normalizedData.stop_id, success: true });
          } catch (err) {
            const errorRecord = await ErrorHandler.recordImportError(
              'stops',
              data,
              rowNumber,
              err.message,
              '检查数据库约束或重复数据'
            );
            errors.push({ row: rowNumber, error: err.message, ...errorRecord });
          }
        })
        .on('end', async () => {
          await ImportService.recordProcessingHistory('stops_import', results.length, 0, errors.length);
          resolve({
            success: results.length,
            errors: errors.length,
            imported: results,
            errorDetails: errors
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  static async importGPSFromJSON(filePath) {
    const results = [];
    const errors = [];

    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const gpsData = JSON.parse(rawData);
      const records = Array.isArray(gpsData) ? gpsData : (gpsData.records || gpsData.data || []);

      for (let i = 0; i < records.length; i++) {
        const data = records[i];
        const rowNumber = i + 1;
        
        const normalizedData = {
          device_id: data.device_id || data.deviceId || data['设备ID'],
          plate_number: data.plate_number || data.plateNumber || data['车牌号'],
          driver_id: data.driver_id || data.driverId || data['司机ID'],
          driver_name: data.driver_name || data.driverName || data['司机姓名'],
          latitude: parseFloat(data.latitude || data.lat || data['纬度']),
          longitude: parseFloat(data.longitude || data.lng || data['经度']),
          timestamp: data.timestamp || data.time || data['时间'],
          speed: data.speed !== undefined ? parseFloat(data.speed) : null
        };

        const validation = ErrorHandler.validateGPSData(normalizedData);
        
        if (!validation.valid) {
          const errorRecord = await ErrorHandler.recordImportError(
            'gps',
            data,
            rowNumber,
            validation.errors,
            validation.suggestion
          );
          errors.push({ row: rowNumber, error: validation.errors, ...errorRecord });
          continue;
        }

        try {
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO gps_records (device_id, plate_number, driver_id, driver_name, latitude, longitude, timestamp, speed)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [normalizedData.device_id, normalizedData.plate_number, normalizedData.driver_id,
               normalizedData.driver_name, normalizedData.latitude, normalizedData.longitude,
               normalizedData.timestamp, normalizedData.speed],
              function(err) {
                if (err) rej(err);
                else res({ id: this.lastID });
              }
            );
          });
          results.push({ row: rowNumber, device_id: normalizedData.device_id, success: true });
        } catch (err) {
          const errorRecord = await ErrorHandler.recordImportError(
            'gps',
            data,
            rowNumber,
            err.message,
            '检查时间格式或数据类型'
          );
          errors.push({ row: rowNumber, error: err.message, ...errorRecord });
        }
      }

      await ImportService.recordProcessingHistory('gps_import', results.length, 0, errors.length);
      return {
        success: results.length,
        errors: errors.length,
        imported: results,
        errorDetails: errors
      };
    } catch (err) {
      throw err;
    }
  }

  static async importComplaintsFromJSON(filePath) {
    const results = [];
    const errors = [];

    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const complaintData = JSON.parse(rawData);
      const records = Array.isArray(complaintData) ? complaintData : (complaintData.records || complaintData.data || []);

      for (let i = 0; i < records.length; i++) {
        const data = records[i];
        const rowNumber = i + 1;
        
        const normalizedData = {
          complaint_id: data.complaint_id || data.complaintId || data.id || `CPL${Date.now()}_${i}`,
          parent_name: data.parent_name || data.parentName || data['家长姓名'],
          parent_phone: data.parent_phone || data.parentPhone || data['家长电话'],
          student_name: data.student_name || data.studentName || data['学生姓名'],
          stop_id: data.stop_id || data.stopId || data['站点ID'],
          stop_name: data.stop_name || data.stopName || data['站点名称'],
          route_id: data.route_id || data.routeId || data['线路ID'],
          complaint_type: data.complaint_type || data.complaintType || data.type || data['类型'],
          complaint_time: data.complaint_time || data.complaintTime || data.time || data['时间'],
          description: data.description || data.desc || data['描述']
        };

        const validation = ErrorHandler.validateComplaintData(normalizedData);
        
        if (!validation.valid) {
          const errorRecord = await ErrorHandler.recordImportError(
            'complaints',
            data,
            rowNumber,
            validation.errors,
            validation.suggestion
          );
          errors.push({ row: rowNumber, error: validation.errors, ...errorRecord });
          continue;
        }

        try {
          await new Promise((res, rej) => {
            db.run(
              `INSERT OR REPLACE INTO complaints (complaint_id, parent_name, parent_phone, student_name, stop_id, stop_name, route_id, complaint_type, complaint_time, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [normalizedData.complaint_id, normalizedData.parent_name, normalizedData.parent_phone,
               normalizedData.student_name, normalizedData.stop_id, normalizedData.stop_name,
               normalizedData.route_id, normalizedData.complaint_type, normalizedData.complaint_time,
               normalizedData.description],
              function(err) {
                if (err) rej(err);
                else res({ id: this.lastID });
              }
            );
          });
          results.push({ row: rowNumber, complaint_id: normalizedData.complaint_id, success: true });
        } catch (err) {
          const errorRecord = await ErrorHandler.recordImportError(
            'complaints',
            data,
            rowNumber,
            err.message,
            '检查申诉ID是否重复'
          );
          errors.push({ row: rowNumber, error: err.message, ...errorRecord });
        }
      }

      await ImportService.recordProcessingHistory('complaints_import', results.length, 0, errors.length);
      return {
        success: results.length,
        errors: errors.length,
        imported: results,
        errorDetails: errors
      };
    } catch (err) {
      throw err;
    }
  }

  static async recordProcessingHistory(processingType, recordCount, anomalyCount, errorCount, details = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO processing_history (processing_type, record_count, anomaly_count, error_count, started_at, finished_at, details)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
        [processingType, recordCount, anomalyCount, errorCount, details],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }
}

module.exports = ImportService;
