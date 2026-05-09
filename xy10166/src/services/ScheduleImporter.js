const fs = require('fs');
const path = require('path');
const Appointment = require('../models/Appointment');

class ScheduleImporter {
  constructor() {
    this.importResults = [];
  }

  async importFromFile(filePath, options = {}) {
    const { overwrite = false, validateOnly = false } = options;
    
    const result = {
      success: false,
      filePath,
      importedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      invalidRecords: [],
      duplicates: [],
      importedIds: [],
      timestamp: new Date()
    };

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      
      let rawData;
      if (ext === '.json') {
        rawData = this._parseJSON(filePath);
      } else if (ext === '.csv') {
        rawData = await this._parseCSV(filePath);
      } else {
        throw new Error(`不支持的文件格式: ${ext}`);
      }

      if (!Array.isArray(rawData)) {
        throw new Error('数据格式错误：需要数组格式');
      }

      const appointments = [];
      for (let i = 0; i < rawData.length; i++) {
        try {
          const apt = new Appointment(rawData[i]);
          const validationErrors = apt.validate();
          
          if (validationErrors.length > 0) {
            result.errorCount++;
            result.invalidRecords.push({
              index: i,
              record: rawData[i],
              errors: validationErrors
            });
            continue;
          }
          appointments.push(apt);
        } catch (e) {
          result.errorCount++;
          result.invalidRecords.push({
            index: i,
            record: rawData[i],
            errors: [e.message]
          });
        }
      }

      if (validateOnly) {
        result.success = true;
        result.importedCount = appointments.length;
        result.message = `验证完成：共 ${rawData.length} 条记录，有效 ${appointments.length} 条，无效 ${result.errorCount} 条`;
        return result;
      }

      const dataFile = path.join(process.cwd(), 'data', 'appointments.json');
      const existingAppointments = this._loadExistingAppointments(dataFile);
      
      const existingIds = new Set(existingAppointments.map(a => a.id));
      const importIds = new Set(appointments.map(a => a.id));
      
      for (const apt of appointments) {
        if (existingIds.has(apt.id) && !overwrite) {
          result.duplicateCount++;
          result.duplicates.push(apt.id);
        } else {
          result.importedCount++;
          result.importedIds.push(apt.id);
        }
      }

      if (overwrite) {
        const finalAppointments = [
          ...existingAppointments.filter(a => !importIds.has(a.id)),
          ...appointments
        ];
        this._saveAppointments(dataFile, finalAppointments);
      } else {
        const newAppointments = appointments.filter(a => !existingIds.has(a.id));
        const finalAppointments = [...existingAppointments, ...newAppointments];
        this._saveAppointments(dataFile, finalAppointments);
      }

      result.success = true;
      let message = `导入完成：成功 ${result.importedCount} 条`;
      if (result.duplicateCount > 0) {
        message += `，跳过重复 ${result.duplicateCount} 条`;
      }
      if (result.errorCount > 0) {
        message += `，无效 ${result.errorCount} 条`;
      }
      result.message = message;

    } catch (error) {
      result.error = error.message;
      result.message = `导入失败: ${error.message}`;
    }

    this.importResults.push(result);
    return result;
  }

  _parseJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`JSON 解析失败: ${e.message}`);
    }
  }

  async _parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV 文件格式错误：缺少表头或数据');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== headers.length) {
        throw new Error(`第 ${i + 1} 行列数不匹配`);
      }
      
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx].trim();
      });
      
      if (record.start_time) record.startTime = record.start_time;
      if (record.end_time) record.endTime = record.end_time;
      if (record.patient_id) record.patientId = record.patient_id;
      if (record.patient_name) record.patientName = record.patient_name;
      if (record.doctor_id) record.doctorId = record.doctor_id;
      if (record.room_id) record.roomId = record.room_id;
      if (record.equipment_id) record.equipmentId = record.equipment_id;
      if (record.appointment_type) record.appointmentType = record.appointment_type;
      
      records.push(record);
    }

    return records;
  }

  _loadExistingAppointments(filePath) {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }

  _saveAppointments(filePath, appointments) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(appointments, null, 2), 'utf-8');
  }
}

module.exports = ScheduleImporter;
