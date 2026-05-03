import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { parse } from 'csv-parse/sync';

export function parseDeviceCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map(record => {
    const timestamp = parseDateTime(record['时间'] || record['时间戳'] || record['Time']);
    return {
      boxId: String(record['箱号'] || record['设备号'] || record['BoxID'] || '').trim(),
      timestamp: timestamp,
      temperature: parseFloat(record['温度'] || record['Temperature'] || '0'),
      humidity: parseFloat(record['湿度'] || record['Humidity'] || '0'),
      doorEvent: parseDoorEvent(record['开门事件'] || record['DoorEvent'] || ''),
      alarmCode: String(record['报警码'] || record['AlarmCode'] || '').trim(),
      rawRecord: record
    };
  }).filter(record => record.boxId && record.timestamp);
}

export function parseBatchCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map(record => {
    const startTime = parseDateTime(record['开始时间'] || record['StartTime'] || '');
    const endTime = parseDateTime(record['结束时间'] || record['EndTime'] || '');
    return {
      batchId: String(record['批次号'] || record['BatchID'] || '').trim(),
      boxId: String(record['箱号'] || record['BoxID'] || '').trim(),
      startTime: startTime,
      endTime: endTime,
      sampleCount: parseInt(record['样本数量'] || record['SampleCount'] || '0', 10),
      operator: String(record['操作员'] || record['Operator'] || '').trim(),
      remarks: String(record['备注'] || record['Remarks'] || '').trim(),
      rawRecord: record
    };
  }).filter(record => record.batchId && record.boxId && record.startTime);
}

export function parseDirectory(directoryPath, type = 'device') {
  const files = readdirSync(directoryPath);
  const allRecords = [];

  for (const file of files) {
    const fullPath = join(directoryPath, file);
    const stat = statSync(fullPath);

    if (stat.isFile() && extname(file).toLowerCase() === '.csv') {
      try {
        const records = type === 'device' 
          ? parseDeviceCSV(fullPath) 
          : parseBatchCSV(fullPath);
        allRecords.push(...records);
      } catch (error) {
        console.warn(`解析文件 ${file} 时出错: ${error.message}`);
      }
    }
  }

  return allRecords;
}

function parseDateTime(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  } catch (e) {}

  const patterns = [
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2}):?(\d{1,2})?$/,
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
    /^(\d{1,2})[/](\d{1,2})[/](\d{4})\s+(\d{1,2}):(\d{1,2}):?(\d{1,2})?$/,
    /^(\d{1,2})[/](\d{1,2})[/](\d{4})$/
  ];

  for (const pattern of patterns) {
    const match = dateStr.trim().match(pattern);
    if (match) {
      let year, month, day, hour = 0, minute = 0, second = 0;
      
      if (pattern.source.includes('d{4}[-/]')) {
        [, year, month, day, hour = 0, minute = 0, second = 0] = match;
      } else {
        [, month, day, year, hour = 0, minute = 0, second = 0] = match;
      }
      
      const date = new Date(year, parseInt(month) - 1, day, hour, minute, second);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

function parseDoorEvent(eventStr) {
  const lower = eventStr.toLowerCase().trim();
  if (lower === 'open' || lower === '开启' || lower === '开门' || lower === '1') {
    return 'OPEN';
  }
  if (lower === 'close' || lower === '关闭' || lower === '关门' || lower === '0') {
    return 'CLOSE';
  }
  return null;
}
