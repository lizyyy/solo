const fs = require('fs');
const path = require('path');
const { loadRecords, saveRecords, generateId, addHistoryEntry } = require('../utils/storage');
const { validateBrakeRecord, normalizeRecord } = require('../utils/validator');

function parseMarkdownTable(mdContent) {
  var lines = mdContent.trim().split('\n');
  var records = [];
  var headerLine = -1;
  var separatorLine = -1;

  for (var i = 0; i < lines.length; i++) {
    if ((lines[i].indexOf('|') !== -1 && lines[i].indexOf('日期') !== -1) || lines[i].indexOf('date') !== -1) {
      headerLine = i;
      if (i + 1 < lines.length && lines[i + 1].indexOf('---') !== -1) {
        separatorLine = i + 1;
      }
      break;
    }
  }

  if (headerLine === -1) {
    return records;
  }

  var headers = lines[headerLine].split('|').map(function(h) { return h.trim().toLowerCase(); }).filter(function(h) { return h; });
  
  for (var j = separatorLine + 1; j < lines.length; j++) {
    var line = lines[j].trim();
    if (!line || line.indexOf('|') === -1) continue;
    if (line.indexOf('---') !== -1) continue;

    var cells = line.split('|').map(function(c) { return c.trim(); }).filter(function(_, idx) { return idx > 0 && idx < headers.length + 1; });
    var record = {};

    for (var k = 0; k < headers.length; k++) {
      var header = headers[k];
      var value = cells[k] || '';
      if (header.indexOf('日期') !== -1 || header === 'date') {
        record.date = value;
      } else if (header.indexOf('班组') !== -1 || header === 'shift') {
        record.shift = value;
      } else if (header.indexOf('车组') !== -1 || header === 'trainno') {
        record.trainNo = value;
      } else if (header.indexOf('车厢') !== -1 || header === 'carriageno') {
        record.carriageNo = value;
      } else if (header.indexOf('制动') !== -1 || header.indexOf('位置') !== -1 || header === 'brakeposition') {
        record.brakePosition = value;
      } else if (header.indexOf('温度') !== -1 || header === 'temperature') {
        record.temperature = parseFloat(value) || 0;
      } else if (header.indexOf('操作员') !== -1 || header.indexOf('记录人') !== -1 || header === 'operator') {
        record.operator = value;
      } else if (header.indexOf('备注') !== -1 || header === 'notes') {
        record.notes = value;
      } else if (header.indexOf('报警') !== -1 || header === 'alarmlevel') {
        record.alarmLevel = value;
      } else if (header.indexOf('来源') !== -1 || header === 'alarmsource') {
        record.alarmSource = value;
      }
    }

    if (record.date || record.trainNo) {
      records.push(record);
    }
  }

  return records;
}

function importData(dataDir, options) {
  const records = loadRecords(dataDir);
  var importedRecords = [];

  if (options.file) {
    var filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error('文件不存在: ' + filePath);
      process.exit(1);
    }

    var content = fs.readFileSync(filePath, 'utf8');
    var ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      try {
        var parsed = JSON.parse(content);
        importedRecords = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('JSON解析失败: ' + e.message);
        process.exit(1);
      }
    } else if (ext === '.md' || ext === '.markdown') {
      importedRecords = parseMarkdownTable(content);
    } else {
      console.error('不支持的文件格式，仅支持 .json 和 .md');
      process.exit(1);
    }
  } else {
    console.error('请使用 -f 指定导入文件路径');
    process.exit(1);
  }

  var successCount = 0;
  var failCount = 0;

  for (var idx = 0; idx < importedRecords.length; idx++) {
    var rawRecord = importedRecords[idx];
    var validation = validateBrakeRecord(rawRecord, options.type);
    if (!validation.valid) {
      console.log('记录 ' + (idx + 1) + ' 验证失败:');
      for (var ei = 0; ei < validation.errors.length; ei++) {
        console.log('  - ' + validation.errors[ei]);
      }
      failCount++;
      continue;
    }

    var record = normalizeRecord(rawRecord, options.type);
    record.id = generateId();
    
    records.push(record);
    addHistoryEntry(dataDir, record.id, 'import', {
      importedFrom: options.file,
      recordType: options.type,
      initialData: record
    }, 'import');

    console.log('导入成功: ' + record.id + ' (' + record.trainNo + '-' + record.carriageNo + ', ' + record.temperature + '°C)');
    successCount++;
  }

  saveRecords(dataDir, records);
  console.log('');
  console.log('导入完成: 成功 ' + successCount + ' 条, 失败 ' + failCount + ' 条');
  console.log('数据目录: ' + dataDir);
}

module.exports = {
  importData: importData,
  parseMarkdownTable: parseMarkdownTable
};
