const fs = require('fs');
const csv = require('csv-parser');
const db = require('../database/schema');

function generateBatchNo() {
  const date = new Date();
  const prefix = 'BATCH';
  const timestamp = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}

function generateRecordNo() {
  const date = new Date();
  const prefix = 'REC';
  const timestamp = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') +
    date.getHours().toString().padStart(2, '0') +
    date.getMinutes().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

function createBatch(batchType, sourceFile, createdBy, totalCount, remark) {
  return new Promise((resolve, reject) => {
    const batchNo = generateBatchNo();
    db.run(
      `INSERT INTO batches (batch_no, batch_type, source_file, created_by, total_count, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [batchNo, batchType, sourceFile, createdBy, totalCount, remark],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, batchNo });
        }
      }
    );
  });
}

function parseInspectionCSV(filePath, batchId) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push({
          batchId,
          recordNo: generateRecordNo(),
          cableCarNo: row['缆车编号'] || row['cable_car_no'] || row['cableCarNo'] || '',
          inspectionItem: row['检修项目'] || row['inspection_item'] || row['inspectionItem'] || '',
          inspectionDate: row['检修日期'] || row['inspection_date'] || row['inspectionDate'] || new Date().toISOString().split('T')[0],
          inspector: row['检修人员'] || row['inspector'] || '',
          inspectionResult: row['检修结果'] || row['inspection_result'] || row['inspectionResult'] || '',
          isKeyItem: (row['关键项'] || row['key_item'] || row['isKeyItem']) === '是' || (row['关键项'] || row['key_item'] || row['isKeyItem']) === '1' || row['isKeyItem'] === true ? 1 : 0,
          trialRunHours: parseFloat(row['试运行时长'] || row['trial_run_hours'] || row['trialRunHours'] || 0)
        });
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', reject);
  });
}

function insertInspectionRecords(records) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO inspection_records 
      (batch_id, record_no, cable_car_no, inspection_item, inspection_date, 
       inspector, inspection_result, is_key_item, trial_run_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      records.forEach(record => {
        stmt.run(
          record.batchId,
          record.recordNo,
          record.cableCarNo,
          record.inspectionItem,
          record.inspectionDate,
          record.inspector,
          record.inspectionResult,
          record.isKeyItem,
          record.trialRunHours
        );
      });
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve(records.length);
      });
    });
  });
}

function parseSensorJSON(filePath, batchId) {
  return new Promise((resolve, reject) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const records = data.map(item => ({
        batchId,
        cableCarNo: item.cableCarNo || item.cable_car_no || item['缆车编号'] || '',
        sensorType: item.sensorType || item.sensor_type || item['传感器类型'] || '',
        sensorValue: item.sensorValue || item.sensor_value || item['数值'] || 0,
        sensorUnit: item.sensorUnit || item.sensor_unit || item['单位'] || '',
        collectTime: item.collectTime || item.collect_time || item['采集时间'] || new Date().toISOString(),
        isNormal: item.isNormal !== undefined ? (item.isNormal ? 1 : 0) : 1,
        thresholdMin: item.thresholdMin || item.threshold_min || item['最小值'] || null,
        thresholdMax: item.thresholdMax || item.threshold_max || item['最大值'] || null
      }));
      resolve(records);
    } catch (err) {
      reject(err);
    }
  });
}

function insertSensorData(records) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO sensor_data 
      (batch_id, cable_car_no, sensor_type, sensor_value, sensor_unit, 
       collect_time, is_normal, threshold_min, threshold_max)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      records.forEach(record => {
        stmt.run(
          record.batchId,
          record.cableCarNo,
          record.sensorType,
          record.sensorValue,
          record.sensorUnit,
          record.collectTime,
          record.isNormal,
          record.thresholdMin,
          record.thresholdMax
        );
      });
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve(records.length);
      });
    });
  });
}

function parseApprovalCSV(filePath, batchId) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        records.push({
          batchId,
          formNo: row['表单编号'] || row['form_no'] || row['formNo'] || `AP${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
          recordId: row['记录ID'] || row['record_id'] || row['recordId'] || null,
          approver: row['审批人'] || row['approver'] || '',
          approveTime: row['审批时间'] || row['approve_time'] || row['approveTime'] || null,
          approveResult: row['审批结果'] || row['approve_result'] || row['approveResult'] || '',
          approveRemark: row['审批备注'] || row['approve_remark'] || row['approveRemark'] || '',
          isSigned: (row['是否签字'] || row['is_signed'] || row['isSigned']) === '是' || (row['是否签字'] || row['is_signed'] || row['isSigned']) === '1' ? 1 : 0
        });
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', reject);
  });
}

function insertApprovalForms(records) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO approval_forms 
      (batch_id, record_id, form_no, approver, approve_time, 
       approve_result, approve_remark, is_signed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.serialize(() => {
      records.forEach(record => {
        stmt.run(
          record.batchId,
          record.recordId,
          record.formNo,
          record.approver,
          record.approveTime,
          record.approveResult,
          record.approveRemark,
          record.isSigned
        );
      });
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve(records.length);
      });
    });
  });
}

module.exports = {
  createBatch,
  parseInspectionCSV,
  insertInspectionRecords,
  parseSensorJSON,
  insertSensorData,
  parseApprovalCSV,
  insertApprovalForms,
  generateRecordNo
};
