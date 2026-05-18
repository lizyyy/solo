const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('fs');

const COLUMN_ORDER = [
  '记录编号',
  '交接日期',
  '班次',
  '护理员姓名',
  '换班时间',
  '产妇姓名',
  '房间号',
  '宝宝情况',
  '产妇情况',
  '特殊事项',
  '交接状态',
  '补全标记',
  '补全时间'
];

const NIGHT_SHIFT_START = '22:00';
const NIGHT_SHIFT_END = '06:00';
const NURSES = ['张护士', '李护士', '王护士', '赵护士', '刘护士'];

function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return { hour: parseInt(parts[0]), minute: parseInt(parts[1] || 0) };
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isOvernight(timeStr) {
  const time = parseTime(timeStr);
  if (!time) return false;
  return time.hour >= 22 || time.hour < 6;
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getNextNurse(currentNurse) {
  const idx = NURSES.indexOf(currentNurse);
  return NURSES[(idx + 1) % NURSES.length];
}

function fillMissingShift(record, index) {
  if (record['班次']) return { record, filled: false };
  
  const shiftTime = record['换班时间'] || '';
  const isNight = isOvernight(shiftTime);
  record['班次'] = isNight ? '夜班' : '白班';
  record['补全标记'] = (record['补全标记'] || '') + '班次;';
  
  return { record, filled: true, type: '班次补全' };
}

function fillMissingNurse(record, index, previousRecord) {
  if (record['护理员姓名']) return { record, filled: false };
  
  let nurse;
  if (previousRecord && previousRecord['护理员姓名']) {
    nurse = getNextNurse(previousRecord['护理员姓名']);
  } else {
    nurse = NURSES[index % NURSES.length];
  }
  
  record['护理员姓名'] = nurse;
  record['补全标记'] = (record['补全标记'] || '') + '护理员;';
  
  return { record, filled: true, type: '护理员补全' };
}

function fillOvernightInfo(record, index, previousRecord) {
  const warnings = [];
  let hasOvernight = false;
  
  if (record['换班时间'] && isOvernight(record['换班时间'])) {
    hasOvernight = true;
    
    if (previousRecord && previousRecord['交接日期'] === record['交接日期']) {
      const prevTime = parseTime(previousRecord['换班时间']);
      const currTime = parseTime(record['换班时间']);
      
      if (prevTime && currTime && currTime.hour < 6 && prevTime.hour >= 22) {
        record['交接日期'] = addDays(record['交接日期'], 1);
        record['补全标记'] = (record['补全标记'] || '') + '跨夜日期;';
        warnings.push({
          type: '跨夜时间处理',
          recordIndex: index,
          message: `检测到跨夜换班，日期已调整为 ${record['交接日期']}`
        });
      }
    }
  }
  
  return { record, hasOvernight, warnings };
}

function fillMissingStatus(record) {
  if (record['交接状态']) return { record, filled: false };
  
  const hasBabyInfo = record['宝宝情况'] && record['宝宝情况'].trim().length > 0;
  const hasMotherInfo = record['产妇情况'] && record['产妇情况'].trim().length > 0;
  
  record['交接状态'] = hasBabyInfo && hasMotherInfo ? '已完成' : '待补充';
  record['补全标记'] = (record['补全标记'] || '') + '交接状态;';
  
  return { record, filled: true, type: '交接状态补全' };
}

function ensureStableColumnOrder(record) {
  const ordered = {};
  COLUMN_ORDER.forEach(col => {
    ordered[col] = record[col] !== undefined ? record[col] : '';
  });
  Object.keys(record).forEach(key => {
    if (!COLUMN_ORDER.includes(key)) {
      ordered[key] = record[key];
    }
  });
  return ordered;
}

function processRecords(records) {
  const results = [];
  const summary = {
    totalRecords: records.length,
    filledFields: 0,
    overnightRecords: 0,
    nurseChanges: 0,
    warnings: [],
    errors: [],
    partialSuccess: false
  };
  
  let previousRecord = null;
  
  records.forEach((record, index) => {
    try {
      let currentRecord = { ...record };
      
      const overnightResult = fillOvernightInfo(currentRecord, index, previousRecord);
      currentRecord = overnightResult.record;
      summary.overnightRecords += overnightResult.hasOvernight ? 1 : 0;
      summary.warnings.push(...overnightResult.warnings);
      if (overnightResult.hasOvernight) summary.partialSuccess = true;
      
      const shiftResult = fillMissingShift(currentRecord, index);
      currentRecord = shiftResult.record;
      if (shiftResult.filled) summary.filledFields++;
      
      const nurseResult = fillMissingNurse(currentRecord, index, previousRecord);
      currentRecord = nurseResult.record;
      if (nurseResult.filled) {
        summary.filledFields++;
        summary.nurseChanges++;
        summary.partialSuccess = true;
      }
      
      const statusResult = fillMissingStatus(currentRecord);
      currentRecord = statusResult.record;
      if (statusResult.filled) summary.filledFields++;
      
      if (currentRecord['补全标记']) {
        const now = new Date();
        currentRecord['补全时间'] = now.toISOString();
        summary.partialSuccess = true;
      }
      
      currentRecord = ensureStableColumnOrder(currentRecord);
      results.push(currentRecord);
      previousRecord = currentRecord;
      
    } catch (error) {
      summary.errors.push({
        recordIndex: index,
        message: error.message,
        stack: error.stack
      });
    }
  });
  
  return { results, summary };
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
}

function writeCsv(filePath, records) {
  const content = stringify(records, {
    header: true,
    columns: COLUMN_ORDER,
    encoding: 'utf-8'
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

module.exports = {
  processRecords,
  readCsv,
  writeCsv,
  COLUMN_ORDER
};