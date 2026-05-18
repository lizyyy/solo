import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG = {
  input: {
    directory: './data',
    filePattern: '*.csv',
    encoding: 'utf-8'
  },
  output: {
    directory: './output',
    auditResult: 'audit_result.csv',
    crossDayRecords: 'cross_day_records.csv',
    retransmittedRecords: 'retransmitted_records.csv',
    deduplicatedRecords: 'deduplicated_records.csv',
    errorReport: 'error_report.json'
  },
  rules: {
    workingHours: {
      start: '08:00',
      end: '20:00'
    },
    crossDay: {
      enabled: true,
      maxDurationHours: 24,
      splitAtMidnight: true
    },
    retransmission: {
      enabled: true,
      timeWindowMinutes: 30,
      similarityThreshold: 0.9
    },
    deduplication: {
      enabled: true,
      keyFields: ['employeeId', 'roomId', 'accessTime'],
      hashAlgorithm: 'md5'
    }
  },
  fields: {
    mapping: {
      employeeId: ['员工ID', '工号', 'employee_id', 'EmployeeID'],
      employeeName: ['员工姓名', '姓名', 'employee_name', 'EmployeeName'],
      roomId: ['会议室ID', '会议室编号', 'room_id', 'RoomID'],
      roomName: ['会议室名称', 'room_name', 'RoomName'],
      accessTime: ['刷卡时间', '门禁时间', 'access_time', 'AccessTime'],
      accessType: ['出入类型', '类型', 'access_type', 'AccessType'],
      deviceId: ['设备ID', 'device_id', 'DeviceID']
    },
    required: ['employeeId', 'roomId', 'accessTime']
  },
  dateFormats: [
    'yyyy-MM-dd HH:mm:ss',
    'yyyy/MM/dd HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
    'dd-MM-yyyy HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy/MM/dd HH:mm'
  ]
};

function loadConfig(configPath) {
  let userConfig = {};
  
  if (configPath && fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      userConfig = JSON.parse(content);
    } catch (error) {
      console.warn(`配置文件解析失败，使用默认配置: ${error.message}`);
    }
  }
  
  return mergeConfig(DEFAULT_CONFIG, userConfig);
}

function mergeConfig(defaultConfig, userConfig) {
  const result = { ...defaultConfig };
  
  for (const key in userConfig) {
    if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
      result[key] = mergeConfig(defaultConfig[key] || {}, userConfig[key]);
    } else {
      result[key] = userConfig[key];
    }
  }
  
  return result;
}

export { DEFAULT_CONFIG, loadConfig };
