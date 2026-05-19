const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const logger = require('../config/logger');
const { maskForExport, maskForLog } = require('../utils/maskSensitive');
const { ReconciliationRecordDAO } = require('../dao/recordDAO');
const { DriverCheckinDAO, GpsTrackDAO, ParentComplaintDAO } = require('../dao/reconciliationDAO');
const { OperationLogDAO } = require('../dao/recordDAO');

const reconciliationRecordDAO = new ReconciliationRecordDAO();
const driverCheckinDAO = new DriverCheckinDAO();
const gpsTrackDAO = new GpsTrackDAO();
const parentComplaintDAO = new ParentComplaintDAO();
const operationLogDAO = new OperationLogDAO();

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const EXPORT_DIR = path.join(__dirname, '../../exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

class ExportService {
  exportToCSV(data, fields, filename) {
    return new Promise((resolve, reject) => {
      try {
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);
        const filePath = path.join(EXPORT_DIR, filename);
        fs.writeFileSync(filePath, csv, 'utf8');
        logger.info('CSV export completed', maskForLog({ filename, recordCount: data.length }));
        resolve(filePath);
      } catch (error) {
        logger.error('CSV export failed', maskForLog({ error: error.message, filename }));
        reject(error);
      }
    });
  }

  async exportReconciliations(filters = {}, exportedBy = 'system') {
    let records;
    if (filters.status) {
      records = await reconciliationRecordDAO.getByStatus(filters.status);
    } else if (filters.startDate && filters.endDate) {
      records = await reconciliationRecordDAO.getByDateRange(filters.startDate, filters.endDate);
    } else {
      records = await reconciliationRecordDAO.getAll();
    }

    const maskedRecords = maskForExport(records);

    const fields = [
      { label: '对账ID', value: 'reconciliation_id' },
      { label: '申诉ID', value: 'complaint_id' },
      { label: '申诉类型', value: 'complaint_type' },
      { label: '学生姓名', value: 'student_name' },
      { label: '司机姓名', value: 'driver_name' },
      { label: '车牌号', value: 'plate_number' },
      { label: '对账日期', value: 'reconciliation_date' },
      { label: '司机打卡时间', value: 'checkin_time' },
      { label: 'GPS到达时间', value: 'gps_arrival_time' },
      { label: '时间差(分钟)', value: 'time_difference' },
      { label: '对账结果', value: 'result' },
      { label: '责任方', value: 'responsibility' },
      { label: '状态', value: 'status' },
      { label: '备注', value: 'notes' },
      { label: '审核人', value: 'reviewed_by' },
      { label: '审核时间', value: 'reviewed_at' }
    ];

    const filename = `reconciliations_${Date.now()}.csv`;
    const filePath = await this.exportToCSV(maskedRecords, fields, filename);

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator: exportedBy,
      operation_type: 'export_reconciliation',
      target_type: 'export_file',
      target_id: filename,
      details: JSON.stringify({ recordCount: records.length, filters })
    });

    return { filePath, filename, recordCount: records.length };
  }

  async exportDriverCheckins(startDate, endDate, exportedBy = 'system') {
    const records = await driverCheckinDAO.getByDateRange(startDate, endDate);
    const maskedRecords = maskForExport(records);

    const fields = [
      { label: '打卡ID', value: 'checkin_id' },
      { label: '司机ID', value: 'driver_id' },
      { label: '车辆ID', value: 'bus_id' },
      { label: '打卡时间', value: 'checkin_time' },
      { label: '签退时间', value: 'checkout_time' },
      { label: '地点', value: 'location' },
      { label: '纬度', value: 'latitude' },
      { label: '经度', value: 'longitude' },
      { label: '打卡类型', value: 'checkin_type' },
      { label: '状态', value: 'status' }
    ];

    const filename = `driver_checkins_${startDate}_to_${endDate}_${Date.now()}.csv`;
    const filePath = await this.exportToCSV(maskedRecords, fields, filename);

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator: exportedBy,
      operation_type: 'export_checkin',
      target_type: 'export_file',
      target_id: filename,
      details: JSON.stringify({ recordCount: records.length, startDate, endDate })
    });

    return { filePath, filename, recordCount: records.length };
  }

  async exportComplaints(filters = {}, exportedBy = 'system') {
    let records;
    if (filters.startDate && filters.endDate) {
      records = await parentComplaintDAO.getByDateRange(filters.startDate, filters.endDate);
    } else {
      records = await parentComplaintDAO.getAll();
    }

    const maskedRecords = maskForExport(records);

    const fields = [
      { label: '申诉ID', value: 'complaint_id' },
      { label: '学生ID', value: 'student_id' },
      { label: '车辆ID', value: 'bus_id' },
      { label: '申诉日期', value: 'complaint_date' },
      { label: '申诉类型', value: 'complaint_type' },
      { label: '描述', value: 'description' },
      { label: '预计到达', value: 'expected_arrival' },
      { label: '实际到达', value: 'actual_arrival' },
      { label: '状态', value: 'status' }
    ];

    const filename = `parent_complaints_${Date.now()}.csv`;
    const filePath = await this.exportToCSV(maskedRecords, fields, filename);

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator: exportedBy,
      operation_type: 'export_complaint',
      target_type: 'export_file',
      target_id: filename,
      details: JSON.stringify({ recordCount: records.length, filters })
    });

    return { filePath, filename, recordCount: records.length };
  }

  async exportGpsTracks(busId, date, exportedBy = 'system') {
    const records = await gpsTrackDAO.getByBusAndDate(busId, date);

    const fields = [
      { label: '轨迹ID', value: 'track_id' },
      { label: '车辆ID', value: 'bus_id' },
      { label: '记录时间', value: 'record_time' },
      { label: '纬度', value: 'latitude' },
      { label: '经度', value: 'longitude' },
      { label: '速度(km/h)', value: 'speed' },
      { label: '方向', value: 'heading' },
      { label: '卫星数', value: 'satellites' }
    ];

    const filename = `gps_tracks_${busId}_${date}_${Date.now()}.csv`;
    const filePath = await this.exportToCSV(records, fields, filename);

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator: exportedBy,
      operation_type: 'export_gps',
      target_type: 'export_file',
      target_id: filename,
      details: JSON.stringify({ recordCount: records.length, busId, date })
    });

    return { filePath, filename, recordCount: records.length };
  }

  async getExportList() {
    return new Promise((resolve, reject) => {
      fs.readdir(EXPORT_DIR, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        const fileList = files.map(file => {
          const filePath = path.join(EXPORT_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            created_at: stats.birthtime,
            path: filePath
          };
        }).sort((a, b) => b.created_at - a.created_at);

        resolve(fileList);
      });
    });
  }

  getFilePath(filename) {
    const filePath = path.join(EXPORT_DIR, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }
}

module.exports = ExportService;