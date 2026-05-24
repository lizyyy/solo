const fs = require('fs');
const path = require('path');
const { detectEncoding, convertToUTF8, validateEncodingConversion } = require('./encoding-detector');
const { 
  inferDelimiter, 
  parseCSVLazy, 
  detectDuplicateHeaders, 
  applyHeaderAliases, 
  isEmptyFile,
  parseCSVLine
} = require('./csv-parser');

const EXIT_CODES = {
  SUCCESS: 0,
  FILE_NOT_FOUND: 1,
  EMPTY_FILE: 2,
  ENCODING_ERROR: 3,
  PARSE_ERROR: 4,
  INVALID_OPTIONS: 5,
  OUTPUT_ERROR: 6,
  CRITICAL_ERROR: 7
};

async function processCSV(filePath, options = {}) {
  const result = {
    inputFile: path.resolve(filePath),
    fileName: path.basename(filePath),
    success: false,
    exitCode: EXIT_CODES.SUCCESS,
    encoding: null,
    delimiter: null,
    headers: [],
    originalHeaders: [],
    records: [],
    badRecords: [],
    statistics: {
      totalLines: 0,
      goodRecords: 0,
      badRecords: 0,
      skippedRecords: 0
    },
    issues: [],
    warnings: [],
    preview: [],
    output: null
  };

  try {
    if (!fs.existsSync(filePath)) {
      result.exitCode = EXIT_CODES.FILE_NOT_FOUND;
      result.issues.push({ type: 'file_not_found', severity: 'critical', message: `文件不存在: ${filePath}` });
      return result;
    }

    const buffer = fs.readFileSync(filePath);
    
    if (buffer.length === 0 || isEmptyFile(buffer.toString('utf-8'))) {
      result.exitCode = EXIT_CODES.EMPTY_FILE;
      result.issues.push({ type: 'empty_file', severity: 'critical', message: '文件为空' });
      return result;
    }

    const encodingCandidates = options.encodingCandidates || null;
    const encodingResult = detectEncoding(buffer, encodingCandidates);
    result.encoding = encodingResult;

    if (encodingResult.isMixedEncoding) {
      result.warnings.push({
        type: 'mixed_encoding',
        message: '检测到可能存在混合编码，结果可能不准确',
        candidates: encodingResult.candidates.slice(0, 2)
      });
    }

    const sourceEncoding = options.forceEncoding || encodingResult.detected;
    const validation = validateEncodingConversion(buffer, sourceEncoding);
    
    if (!validation.valid) {
      result.exitCode = EXIT_CODES.ENCODING_ERROR;
      result.issues.push(...validation.issues);
      return result;
    }

    if (validation.issues.length > 0) {
      result.warnings.push(...validation.issues);
    }

    const content = validation.decoded;
    const lines = content.split(/\r?\n/);
    result.statistics.totalLines = lines.length;

    const delimiter = options.delimiter || inferDelimiter(content).delimiter;
    result.delimiter = delimiter;

    const parseResult = parseCSVLazy(content, delimiter, options);
    
    if (!parseResult.records || parseResult.records.length === 0) {
      result.exitCode = EXIT_CODES.PARSE_ERROR;
      result.issues.push({ type: 'no_records', severity: 'high', message: '未解析到任何数据记录' });
      return result;
    }

    const hasHeader = options.hasHeader !== false;
    let headers = [];
    let dataStartIndex = 0;

    if (hasHeader && parseResult.records[0] && parseResult.records[0].columns) {
      headers = parseResult.records[0].columns;
      result.originalHeaders = [...headers];
      dataStartIndex = 1;

      if (options.headerAliases) {
        headers = applyHeaderAliases(headers, options.headerAliases);
      }

      const duplicates = detectDuplicateHeaders(headers);
      if (duplicates.length > 0) {
        result.warnings.push({
          type: 'duplicate_headers',
          message: `发现 ${duplicates.length} 个重复表头`,
          duplicates
        });
        headers = makeHeadersUnique(headers);
      }
    }

    result.headers = headers;

    for (let i = dataStartIndex; i < parseResult.records.length; i++) {
      const record = parseResult.records[i];
      
      if (record.isBad) {
        const badRecord = {
          lineNumber: record.lineNumber,
          lineNumbers: record.lineNumbers,
          columns: record.columns,
          columnCount: record.columns.length,
          expectedColumns: headers.length || parseResult.expectedColumns,
          type: parseResult.badLines.find(b => b.lineNumber === record.lineNumber)?.type || 'unknown',
          message: parseResult.badLines.find(b => b.lineNumber === record.lineNumber)?.message || '未知错误'
        };

        if (options.keepBadRecords) {
          result.records.push(mapToObject(record.columns, headers, record.lineNumber));
          result.badRecords.push(badRecord);
        } else {
          result.badRecords.push(badRecord);
        }
        result.statistics.badRecords++;
      } else {
        result.records.push(mapToObject(record.columns, headers, record.lineNumber));
        result.statistics.goodRecords++;
      }
    }

    result.preview = result.records.slice(0, options.previewCount || 5);

    result.success = result.issues.length === 0 || 
                    result.issues.every(i => i.severity !== 'critical');
    
    if (!result.success) {
      result.exitCode = result.issues.some(i => i.severity === 'critical') 
        ? EXIT_CODES.CRITICAL_ERROR 
        : EXIT_CODES.PARSE_ERROR;
    }

  } catch (error) {
    result.exitCode = EXIT_CODES.CRITICAL_ERROR;
    result.issues.push({ 
      type: 'unexpected_error', 
      severity: 'critical', 
      message: error.message,
      stack: error.stack
    });
  }

  return result;
}

function mapToObject(columns, headers, lineNumber) {
  const obj = { _lineNumber: lineNumber };
  
  if (headers.length > 0) {
    headers.forEach((header, index) => {
      obj[header] = columns[index] || '';
    });
  } else {
    columns.forEach((col, index) => {
      obj[`col_${index}`] = col;
    });
  }
  
  return obj;
}

function makeHeadersUnique(headers) {
  const seen = new Map();
  return headers.map(header => {
    if (!seen.has(header)) {
      seen.set(header, 1);
      return header;
    }
    const count = seen.get(header);
    seen.set(header, count + 1);
    return `${header}_${count}`;
  });
}

function generateFixedCSV(result, options = {}) {
  const delimiter = options.outputDelimiter || ',';
  const lines = [];

  if (result.headers.length > 0) {
    lines.push(result.headers.map(h => escapeCSV(h, delimiter)).join(delimiter));
  }

  for (const record of result.records) {
    const values = result.headers.map(h => record[h] || '');
    lines.push(values.map(v => escapeCSV(String(v), delimiter)).join(delimiter));
  }

  return lines.join('\n');
}

function escapeCSV(value, delimiter) {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

module.exports = {
  processCSV,
  generateFixedCSV,
  EXIT_CODES
};
