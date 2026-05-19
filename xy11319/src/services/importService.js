const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const logger = require('../config/logger');
const { maskForLog, maskForExport, maskForResponse } = require('../utils/maskSensitive');
const { DriverCheckinDAO, GpsTrackDAO, ParentComplaintDAO } = require('../dao/reconciliationDAO');
const { ImportBatchDAO, OperationLogDAO } = require('../dao/recordDAO');
const { DriverDAO, BusDAO, StudentDAO } = require('../dao/baseDAO');

const driverCheckinDAO = new DriverCheckinDAO();
const gpsTrackDAO = new GpsTrackDAO();
const parentComplaintDAO = new ParentComplaintDAO();
const importBatchDAO = new ImportBatchDAO();
const operationLogDAO = new OperationLogDAO();
const driverDAO = new DriverDAO();
const busDAO = new BusDAO();
const studentDAO = new StudentDAO();

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class ImportService {
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async importDriverCheckins(filePath, createdBy = 'system') {
    const batchId = generateId('BATCH_CHECKIN');
    
    try {
      await importBatchDAO.create({
        batch_id: batchId,
        batch_type: 'driver_checkin',
        file_name: path.basename(filePath),
        created_by: createdBy
      });

      const records = await this.parseCSV(filePath);
      logger.info(`Parsed ${records.length} driver checkin records`, maskForLog({ batchId }));

      const checkins = records.map((record, index) => ({
        checkin_id: generateId('CHECKIN'),
        driver_id: record.driver_id,
        bus_id: record.bus_id,
        checkin_time: record.checkin_time,
        checkout_time: record.checkout_time || null,
        location: record.location || null,
        latitude: record.latitude ? parseFloat(record.latitude) : null,
        longitude: record.longitude ? parseFloat(record.longitude) : null,
        checkin_type: record.checkin_type || 'morning',
        status: record.status || 'completed',
        import_batch_id: batchId
      }));

      const results = await driverCheckinDAO.batchCreate(checkins);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      await importBatchDAO.updateStatus(batchId, 'completed', successCount, failedCount);

      await operationLogDAO.create({
        log_id: generateId('LOG'),
        operator: createdBy,
        operation_type: 'import_driver_checkin',
        target_type: 'import_batch',
        target_id: batchId,
        details: JSON.stringify({ total: records.length, success: successCount, failed: failedCount })
      });

      return {
        batchId,
        total: records.length,
        successCount,
        failedCount,
        failedRecords: results.filter(r => !r.success).map(r => r.data)
      };
    } catch (error) {
      logger.error('Import driver checkins failed', maskForLog({ error: error.message, batchId }));
      await importBatchDAO.updateStatus(batchId, 'failed', 0, 0, error.message);
      throw error;
    }
  }

  async importGpsTracks(filePath, createdBy = 'system') {
    const batchId = generateId('BATCH_GPS');
    
    try {
      await importBatchDAO.create({
        batch_id: batchId,
        batch_type: 'gps_track',
        file_name: path.basename(filePath),
        created_by: createdBy
      });

      const records = await this.parseCSV(filePath);
      logger.info(`Parsed ${records.length} GPS track records`, maskForLog({ batchId }));

      const tracks = records.map(record => ({
        track_id: generateId('GPS'),
        bus_id: record.bus_id,
        record_time: record.record_time,
        latitude: parseFloat(record.latitude),
        longitude: parseFloat(record.longitude),
        speed: record.speed ? parseFloat(record.speed) : null,
        heading: record.heading ? parseInt(record.heading) : null,
        satellites: record.satellites ? parseInt(record.satellites) : null,
        import_batch_id: batchId
      }));

      const results = await gpsTrackDAO.batchCreate(tracks);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      await importBatchDAO.updateStatus(batchId, 'completed', successCount, failedCount);

      await operationLogDAO.create({
        log_id: generateId('LOG'),
        operator: createdBy,
        operation_type: 'import_gps_track',
        target_type: 'import_batch',
        target_id: batchId,
        details: JSON.stringify({ total: records.length, success: successCount, failed: failedCount })
      });

      return {
        batchId,
        total: records.length,
        successCount,
        failedCount,
        failedRecords: results.filter(r => !r.success).map(r => r.data)
      };
    } catch (error) {
      logger.error('Import GPS tracks failed', maskForLog({ error: error.message, batchId }));
      await importBatchDAO.updateStatus(batchId, 'failed', 0, 0, error.message);
      throw error;
    }
  }

  async importParentComplaints(filePath, createdBy = 'system') {
    const batchId = generateId('BATCH_COMPLAINT');
    
    try {
      await importBatchDAO.create({
        batch_id: batchId,
        batch_type: 'parent_complaint',
        file_name: path.basename(filePath),
        created_by: createdBy
      });

      const records = await this.parseCSV(filePath);
      logger.info(`Parsed ${records.length} parent complaint records`, maskForLog({ batchId }));

      const complaints = records.map(record => ({
        complaint_id: generateId('COMPLAINT'),
        student_id: record.student_id,
        bus_id: record.bus_id || null,
        complaint_date: record.complaint_date,
        complaint_type: record.complaint_type,
        description: record.description || null,
        expected_arrival: record.expected_arrival || null,
        actual_arrival: record.actual_arrival || null,
        status: 'pending',
        import_batch_id: batchId
      }));

      const results = await parentComplaintDAO.batchCreate(complaints);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      await importBatchDAO.updateStatus(batchId, 'completed', successCount, failedCount);

      await operationLogDAO.create({
        log_id: generateId('LOG'),
        operator: createdBy,
        operation_type: 'import_parent_complaint',
        target_type: 'import_batch',
        target_id: batchId,
        details: JSON.stringify({ total: records.length, success: successCount, failed: failedCount })
      });

      return {
        batchId,
        total: records.length,
        successCount,
        failedCount,
        failedRecords: results.filter(r => !r.success).map(r => r.data)
      };
    } catch (error) {
      logger.error('Import parent complaints failed', maskForLog({ error: error.message, batchId }));
      await importBatchDAO.updateStatus(batchId, 'failed', 0, 0, error.message);
      throw error;
    }
  }

  async importBaseData(filePath, dataType, createdBy = 'system') {
    const batchId = generateId(`BATCH_${dataType.toUpperCase()}`);
    
    try {
      await importBatchDAO.create({
        batch_id: batchId,
        batch_type: `base_${dataType}`,
        file_name: path.basename(filePath),
        created_by: createdBy
      });

      const records = await this.parseCSV(filePath);
      logger.info(`Parsed ${records.length} ${dataType} records`, maskForLog({ batchId }));

      let successCount = 0;
      let failedCount = 0;

      for (const record of records) {
        try {
          if (dataType === 'driver') {
            await driverDAO.create({
              driver_id: record.driver_id,
              name: record.name,
              phone: record.phone,
              id_card: record.id_card
            });
          } else if (dataType === 'bus') {
            await busDAO.create({
              bus_id: record.bus_id,
              plate_number: record.plate_number,
              route_name: record.route_name,
              capacity: record.capacity
            });
          } else if (dataType === 'student') {
            await studentDAO.create({
              student_id: record.student_id,
              name: record.name,
              parent_name: record.parent_name,
              parent_phone: record.parent_phone,
              school_class: record.school_class,
              route_id: record.route_id
            });
          }
          successCount++;
        } catch (error) {
          failedCount++;
          logger.warn(`Failed to import ${dataType} record`, maskForLog({ error: error.message, record }));
        }
      }

      await importBatchDAO.updateStatus(batchId, 'completed', successCount, failedCount);

      return { batchId, total: records.length, successCount, failedCount };
    } catch (error) {
      logger.error(`Import ${dataType} failed`, maskForLog({ error: error.message, batchId }));
      await importBatchDAO.updateStatus(batchId, 'failed', 0, 0, error.message);
      throw error;
    }
  }
}

module.exports = ImportService;