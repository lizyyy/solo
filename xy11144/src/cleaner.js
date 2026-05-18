const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const BUSINESS_COLUMNS = [
  'record_id',
  'stall_id',
  'stall_name',
  'probe_id',
  'seafood_type',
  'batch_number',
  'temperature',
  'temperature_unit',
  'record_time',
  'operator',
  'notes'
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseDateTime(dateStr) {
  if (!dateStr) return null;
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:?\d{2})?$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      return new Date(dateStr);
    }
  }
  return null;
}

function detectTimezoneIssue(dateStr, targetTimezone) {
  if (!dateStr) return null;
  
  if (dateStr.includes('Z') || dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
    return {
      type: 'timezone_explicit',
      issue: '记录包含显式时区标记',
      original: dateStr
    };
  }
  
  const date = parseDateTime(dateStr);
  if (date) {
    const localHour = date.getHours();
    const utcHour = date.getUTCHours();
    if (localHour !== utcHour + 8) {
      return {
        type: 'timezone_mismatch',
        issue: '时区偏移与目标时区不匹配',
        original: dateStr,
        expectedOffset: '+08:00'
      };
    }
  }
  
  return null;
}

function detectProbeBatteryChange(current, previous) {
  if (!previous) return null;
  
  const currentTime = parseDateTime(current.record_time);
  const previousTime = parseDateTime(previous.record_time);
  
  if (!currentTime || !previousTime) return null;
  
  const timeDiff = currentTime - previousTime;
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff > 4 && current.probe_id === previous.probe_id) {
    return {
      type: 'battery_change',
      issue: '探头长时间离线（可能换电）',
      offline_duration_hours: Math.round(hoursDiff * 10) / 10,
      previous_record_time: previous.record_time,
      current_record_time: current.record_time
    };
  }
  
  if (current.probe_id !== previous.probe_id) {
    return {
      type: 'probe_switch',
      issue: '探头ID变更',
      previous_probe: previous.probe_id,
      current_probe: current.probe_id
    };
  }
  
  return null;
}

function validateFormat(row, lineNumber) {
  const errors = [];
  
  if (!row.record_id || !/^SR-\d{6}$/.test(row.record_id)) {
    errors.push({
      field: 'record_id',
      issue: '记录ID格式错误（应为SR-xxxxxx）',
      value: row.record_id
    });
  }
  
  if (!row.stall_id || !/^ST-[A-Z]\d{2}$/.test(row.stall_id)) {
    errors.push({
      field: 'stall_id',
      issue: '档口ID格式错误（应为ST-Axx）',
      value: row.stall_id
    });
  }
  
  if (!row.probe_id || !/^TP-\d{4}$/.test(row.probe_id)) {
    errors.push({
      field: 'probe_id',
      issue: '探头ID格式错误（应为TP-xxxx）',
      value: row.probe_id
    });
  }
  
  const temp = parseFloat(row.temperature);
  if (isNaN(temp) || temp < -30 || temp > 50) {
    errors.push({
      field: 'temperature',
      issue: '温度值超出有效范围（-30°C ~ 50°C）',
      value: row.temperature
    });
  }
  
  if (!row.temperature_unit || !['°C', '℃', 'C'].includes(row.temperature_unit)) {
    errors.push({
      field: 'temperature_unit',
      issue: '温度单位错误（应为°C）',
      value: row.temperature_unit
    });
  }
  
  const seafoodTypes = ['龙虾', '鲍鱼', '三文鱼', '螃蟹', '扇贝', '生蚝', '基围虾', '石斑鱼'];
  if (!row.seafood_type || !seafoodTypes.includes(row.seafood_type)) {
    errors.push({
      field: 'seafood_type',
      issue: '海鲜品类不在有效列表中',
      value: row.seafood_type
    });
  }
  
  if (!row.batch_number || !/^BATCH-\d{8}-\d{3}$/.test(row.batch_number)) {
    errors.push({
      field: 'batch_number',
      issue: '批次号格式错误（应为BATCH-YYYYMMDD-xxx）',
      value: row.batch_number
    });
  }
  
  const date = parseDateTime(row.record_time);
  if (!date) {
    errors.push({
      field: 'record_time',
      issue: '记录时间格式无法解析',
      value: row.record_time
    });
  }
  
  return errors.length > 0 ? {
    type: 'format_error',
    line_number: lineNumber,
    errors: errors
  } : null;
}

function normalizeRow(row) {
  const normalized = { ...row };
  
  if (normalized.temperature_unit === 'C') {
    normalized.temperature_unit = '°C';
  }
  
  if (normalized.record_time) {
    const date = parseDateTime(normalized.record_time);
    if (date) {
      normalized.record_time = date.toISOString().replace('T', ' ').substring(0, 19);
    }
  }
  
  return normalized;
}

function stableSort(rows) {
  return [...rows].sort((a, b) => {
    if (a.stall_id !== b.stall_id) {
      return a.stall_id.localeCompare(b.stall_id);
    }
    if (a.probe_id !== b.probe_id) {
      return a.probe_id.localeCompare(b.probe_id);
    }
    if (a.record_time !== b.record_time) {
      return a.record_time.localeCompare(b.record_time);
    }
    return a.record_id.localeCompare(b.record_id);
  });
}

async function cleanTemperatureData(inputPath, outputDir, targetTimezone) {
  ensureDir(outputDir);
  
  const rows = [];
  const formatErrors = [];
  const timezoneIssues = [];
  const probeBatteryChanges = [];
  const cleanRows = [];
  const evidenceRows = [];
  
  let lineNumber = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (row) => {
        lineNumber++;
        
        const formatError = validateFormat(row, lineNumber);
        if (formatError) {
          formatErrors.push({ ...row, ...formatError });
          return;
        }
        
        const timezoneIssue = detectTimezoneIssue(row.record_time, targetTimezone);
        if (timezoneIssue) {
          timezoneIssues.push({ ...row, ...timezoneIssue });
        }
        
        rows.push(row);
      })
      .on('end', async () => {
        const sortedRows = stableSort(rows);
        
        let previousRow = null;
        for (const row of sortedRows) {
          const batteryChange = detectProbeBatteryChange(row, previousRow);
          if (batteryChange) {
            probeBatteryChanges.push({ ...row, ...batteryChange });
          }
          
          const normalizedRow = normalizeRow(row);
          cleanRows.push(normalizedRow);
          
          evidenceRows.push({
            ...normalizedRow,
            has_timezone_issue: timezoneIssues.some(t => t.record_id === row.record_id) ? '是' : '否',
            has_battery_change: batteryChange ? '是' : '否',
            cleaning_status: '已清洗'
          });
          
          previousRow = row;
        }
        
        const files = await writeOutputs(outputDir, cleanRows, formatErrors, timezoneIssues, probeBatteryChanges, evidenceRows);
        
        resolve({
          summary: {
            total_records: rows.length + formatErrors.length,
            clean_records: cleanRows.length,
            format_error_count: formatErrors.length,
            timezone_issue_count: timezoneIssues.length,
            probe_battery_change_count: probeBatteryChanges.length
          },
          files
        });
      })
      .on('error', reject);
  });
}

async function writeOutputs(outputDir, cleanRows, formatErrors, timezoneIssues, probeBatteryChanges, evidenceRows) {
  const files = {};
  
  const cleanWriter = createCsvWriter({
    path: path.join(outputDir, 'cleaned-temperature-data.csv'),
    header: BUSINESS_COLUMNS.map(col => ({ id: col, title: col }))
  });
  await cleanWriter.writeRecords(cleanRows);
  files['清洗后温度数据'] = path.join(outputDir, 'cleaned-temperature-data.csv');
  
  const evidenceWriter = createCsvWriter({
    path: path.join(outputDir, 'cleaning-evidence.csv'),
    header: [
      ...BUSINESS_COLUMNS.map(col => ({ id: col, title: col })),
      { id: 'has_timezone_issue', title: '是否有时区问题' },
      { id: 'has_battery_change', title: '是否有探头换电' },
      { id: 'cleaning_status', title: '清洗状态' }
    ]
  });
  await evidenceWriter.writeRecords(evidenceRows);
  files['清洗证据记录'] = path.join(outputDir, 'cleaning-evidence.csv');
  
  if (formatErrors.length > 0) {
    const formatErrorWriter = createCsvWriter({
      path: path.join(outputDir, 'format-errors.csv'),
      header: [
        { id: 'line_number', title: '行号' },
        ...BUSINESS_COLUMNS.map(col => ({ id: col, title: col })),
        { id: 'errors', title: '错误详情' }
      ]
    });
    await formatErrorWriter.writeRecords(formatErrors.map(e => ({
      ...e,
      errors: JSON.stringify(e.errors)
    })));
    files['格式错误明细'] = path.join(outputDir, 'format-errors.csv');
  }
  
  if (timezoneIssues.length > 0) {
    const timezoneWriter = createCsvWriter({
      path: path.join(outputDir, 'timezone-issues.csv'),
      header: [
        ...BUSINESS_COLUMNS.map(col => ({ id: col, title: col })),
        { id: 'type', title: '问题类型' },
        { id: 'issue', title: '问题描述' },
        { id: 'original', title: '原始时间' }
      ]
    });
    await timezoneWriter.writeRecords(timezoneIssues);
    files['时区问题明细'] = path.join(outputDir, 'timezone-issues.csv');
  }
  
  if (probeBatteryChanges.length > 0) {
    const batteryWriter = createCsvWriter({
      path: path.join(outputDir, 'probe-battery-changes.csv'),
      header: [
        ...BUSINESS_COLUMNS.map(col => ({ id: col, title: col })),
        { id: 'type', title: '变更类型' },
        { id: 'issue', title: '变更描述' },
        { id: 'offline_duration_hours', title: '离线时长(小时)' },
        { id: 'previous_record_time', title: '上条记录时间' }
      ]
    });
    await batteryWriter.writeRecords(probeBatteryChanges);
    files['探头换电/变更明细'] = path.join(outputDir, 'probe-battery-changes.csv');
  }
  
  return files;
}

module.exports = {
  cleanTemperatureData,
  BUSINESS_COLUMNS,
  stableSort
};
