'use strict';

const fs = require('fs');
const path = require('path');
const chardet = require('chardet');
const iconv = require('iconv-lite');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { finished } = require('stream/promises');

async function convertCSV(options) {
  const result = {
    inputFile: options.inputFile,
    fileName: options.fileName,
    detectedEncoding: null,
    totalRows: 0,
    successRows: 0,
    badRows: 0,
    duplicateRows: 0,
    columnMapping: {},
    originalColumns: [],
    normalizedColumns: [],
    badRowsList: [],
    duplicateRowsList: [],
    outputFile: null,
    badRowsFile: null,
    reportDir: null,
    success: true,
    startTime: Date.now(),
    endTime: null
  };

  try {
    ensureOutputDir(options);
    setOutputPaths(result, options);
    checkIdempotency(result, options);

    result.detectedEncoding = detectEncoding(options);
    if (!options.quiet) {
      console.log(`🔍 探测编码: ${result.detectedEncoding}`);
    }

    await processFile(result, options);

    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;

  } catch (err) {
    result.success = false;
    result.error = err.message;
    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
  }

  return result;
}

function ensureOutputDir(options) {
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }
  
  const reportDir = path.join(options.outputDir, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
}

function setOutputPaths(result, options) {
  result.outputFile = path.join(options.outputDir, `${options.fileName}.ndjson`);
  result.badRowsFile = path.join(options.outputDir, `${options.fileName}-bad-rows.csv`);
  result.reportDir = path.join(options.outputDir, 'reports');
}

function checkIdempotency(result, options) {
  if (fs.existsSync(result.outputFile) && !options.force) {
    throw new Error(`输出文件已存在: ${result.outputFile}, 使用 --force 覆盖`);
  }
}

function detectEncoding(options) {
  if (options.encoding) {
    return options.encoding;
  }
  
  const buffer = fs.readFileSync(options.inputFile);
  return chardet.detect(buffer) || 'UTF-8';
}

async function processFile(result, options) {
  const buffer = fs.readFileSync(options.inputFile);
  let content;
  
  if (iconv.encodingExists(result.detectedEncoding)) {
    content = iconv.decode(buffer, result.detectedEncoding);
  } else {
    content = buffer.toString('utf8');
  }

  const lines = content.split(/\r?\n/);
  
  if (options.skipRows > 0) {
    content = lines.slice(options.skipRows).join('\n');
  }

  const outputStream = fs.createWriteStream(result.outputFile);
  const badRowsStream = fs.createWriteStream(result.badRowsFile);
  
  const seenKeys = new Set();
  let headerWritten = false;
  let lineNumber = options.skipRows + 1;

  const stream = Readable.from(content)
    .pipe(csv({ separator: options.delimiter, strict: false }))
    .on('headers', (headers) => {
      result.originalColumns = headers;
      result.normalizedColumns = normalizeColumns(headers, options);
      result.columnMapping = buildColumnMapping(headers, options);
      
      if (!options.quiet) {
        console.log(`📝 原始列名: ${headers.join(', ')}`);
        console.log(`✅ 归一化列名: ${result.normalizedColumns.join(', ')}`);
      }

      const badRowHeader = ['_line_number', '_error', '_raw_content', ...headers];
      badRowsStream.write(badRowHeader.join(',') + '\n');
      headerWritten = true;
    });

  for await (const row of stream) {
    lineNumber++;
    result.totalRows++;

    try {
      const normalizedRow = normalizeRow(row, result.columnMapping, options);
      const isDuplicate = checkDuplicate(normalizedRow, seenKeys, options);

      if (isDuplicate) {
        result.duplicateRows++;
        result.duplicateRowsList.push({
          lineNumber,
          data: normalizedRow
        });
        continue;
      }

      outputStream.write(JSON.stringify(normalizedRow) + '\n');
      result.successRows++;
    } catch (err) {
      result.badRows++;
      result.badRowsList.push({
        lineNumber,
        error: err.message,
        rawContent: row
      });

      const badRowValues = [
        lineNumber,
        `"${err.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(row).replace(/"/g, '""')}"`,
        ...result.originalColumns.map(col => {
          const val = row[col] || '';
          return `"${val.replace(/"/g, '""')}"`;
        })
      ];
      badRowsStream.write(badRowValues.join(',') + '\n');
    }
  }

  outputStream.end();
  badRowsStream.end();

  await new Promise(resolve => {
    outputStream.on('finish', resolve);
  });
  await new Promise(resolve => {
    badRowsStream.on('finish', resolve);
  });

  if (result.badRows === result.totalRows && result.totalRows > 0) {
    result.success = false;
  }
}

function normalizeColumns(columns, options) {
  return columns.map(col => {
    let normalized = col
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^\w\u4e00-\u9fa5]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (options.columnMap && options.columnMap[col]) {
      normalized = options.columnMap[col];
    }

    return normalized;
  });
}

function buildColumnMapping(originalColumns, options) {
  const mapping = {};
  
  originalColumns.forEach((col, index) => {
    let normalized = col
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^\w\u4e00-\u9fa5]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (options.columnMap && options.columnMap[col]) {
      normalized = options.columnMap[col];
    }

    mapping[col] = normalized;
  });

  return mapping;
}

function normalizeRow(row, columnMapping, options) {
  const result = {};

  for (const [originalKey, value] of Object.entries(row)) {
    const normalizedKey = columnMapping[originalKey] || originalKey;
    
    let normalizedValue = value;
    if (options.nullValues.includes(value)) {
      normalizedValue = null;
    }

    result[normalizedKey] = normalizedValue;
  }

  return result;
}

function checkDuplicate(row, seenKeys, options) {
  if (options.idColumns.length === 0) {
    return false;
  }

  const keyParts = options.idColumns.map(col => {
    const val = row[col];
    if (val === undefined || val === null) {
      throw new Error(`幂等键列不存在或为空: ${col}`);
    }
    return String(val);
  });

  const key = keyParts.join('|');
  
  if (seenKeys.has(key)) {
    return true;
  }

  seenKeys.add(key);
  return false;
}

module.exports = { convertCSV };
