import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

export class ScheduleParser {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls', '.csv'];
    this.errors = [];
  }

  parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.supportedFormats.includes(ext)) {
      this.errors.push({
        file: filePath,
        type: 'FORMAT_ERROR',
        message: `不支持的文件格式: ${ext}`
      });
      return null;
    }

    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      return this.normalizeData(data, filePath);
    } catch (error) {
      this.errors.push({
        file: filePath,
        type: 'PARSE_ERROR',
        message: `文件解析失败: ${error.message}`
      });
      return null;
    }
  }

  normalizeData(data, filePath) {
    const schedules = [];
    const warnings = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const schedule = this.normalizeRow(row, i + 2);
      
      if (schedule) {
        if (schedule.warnings) {
          warnings.push(...schedule.warnings.map(w => ({
            ...w,
            file: filePath,
            row: i + 2
          })));
        }
        schedules.push(schedule);
      } else {
        warnings.push({
          file: filePath,
          row: i + 2,
          type: 'SKIPPED_ROW',
          message: `第 ${i + 2} 行数据不完整，已跳过`
        });
      }
    }

    return {
      file: filePath,
      schedules,
      warnings
    };
  }

  normalizeRow(row, rowNum) {
    const driverName = this.getStringValue(row, ['司机姓名', '司机', '姓名', '驾驶员']);
    const vehicleNo = this.getStringValue(row, ['车牌号', '车辆', '车号', '车牌']);
    const shiftDate = this.getDateValue(row, ['日期', '排班日期', '班次日期']);
    const startTime = this.getTimeValue(row, ['开始时间', '发车时间', '上班时间', '起始时间']);
    const endTime = this.getTimeValue(row, ['结束时间', '收车时间', '下班时间', '终止时间']);
    const route = this.getStringValue(row, ['线路', '路线', '班次', '任务']);
    const remark = this.getStringValue(row, ['备注', '说明', '注释']);

    const warnings = [];

    if (!driverName) {
      return null;
    }

    if (!vehicleNo) {
      warnings.push({
        type: 'MISSING_VEHICLE',
        message: `司机 "${driverName}" 缺少车辆信息`
      });
    }

    if (!shiftDate) {
      warnings.push({
        type: 'MISSING_DATE',
        message: `司机 "${driverName}" 缺少排班日期`
      });
      return null;
    }

    if (!startTime || !endTime) {
      warnings.push({
        type: 'MISSING_TIME',
        message: `司机 "${driverName}" 缺少班次时间`
      });
      return null;
    }

    const startDateTime = this.combineDateTime(shiftDate, startTime);
    const endDateTime = this.combineDateTime(shiftDate, endTime);

    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
      warnings.push({
        type: 'CROSS_DAY_SHIFT',
        message: `司机 "${driverName}" 班次跨日，已自动调整结束时间为次日`
      });
    }

    const isMaintenance = this.isMaintenance(remark, route);
    if (isMaintenance) {
      warnings.push({
        type: 'VEHICLE_MAINTENANCE',
        message: `车辆 "${vehicleNo}" 标记为保养状态`
      });
    }

    const isConcurrent = this.isConcurrentPost(remark, route);
    if (isConcurrent) {
      warnings.push({
        type: 'CONCURRENT_POST',
        message: `司机 "${driverName}" 标记为兼岗状态`
      });
    }

    return {
      driverName,
      vehicleNo,
      shiftDate,
      startTime,
      endTime,
      startDateTime,
      endDateTime,
      route,
      remark,
      isMaintenance,
      isConcurrent,
      rowNum,
      warnings: warnings.length > 0 ? warnings : null
    };
  }

  getStringValue(row, keys) {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).trim();
      }
    }
    return null;
  }

  getDateValue(row, keys) {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        const value = row[key];
        if (value instanceof Date) {
          return value;
        }
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return null;
  }

  getTimeValue(row, keys) {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        const value = String(row[key]).trim();
        const timeMatch = value.match(/(\d{1,2})[:：](\d{2})/);
        if (timeMatch) {
          return {
            hour: parseInt(timeMatch[1]),
            minute: parseInt(timeMatch[2])
          };
        }
        if (value.length === 4 && /^\d+$/.test(value)) {
          return {
            hour: parseInt(value.substring(0, 2)),
            minute: parseInt(value.substring(2))
          };
        }
      }
    }
    return null;
  }

  combineDateTime(date, time) {
    const result = new Date(date);
    result.setHours(time.hour, time.minute, 0, 0);
    return result;
  }

  isMaintenance(remark, route) {
    const maintenanceKeywords = ['保养', '维修', '检修', '维护'];
    const text = (remark || '') + (route || '');
    return maintenanceKeywords.some(keyword => text.includes(keyword));
  }

  isConcurrentPost(remark, route) {
    const concurrentKeywords = ['兼岗', '兼职', '顶岗', '代班'];
    const text = (remark || '') + (route || '');
    return concurrentKeywords.some(keyword => text.includes(keyword));
  }

  parseDirectory(dirPath) {
    const results = [];
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (this.supportedFormats.includes(ext)) {
        const fullPath = path.join(dirPath, file);
        const result = this.parseFile(fullPath);
        if (result) {
          results.push(result);
        }
      }
    }
    
    return results;
  }

  getErrors() {
    return this.errors;
  }
}
