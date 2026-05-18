const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const REQUIRED_FIELDS = ['装备编号', '装备名称', '所属套装', '数量', '状态', '备注'];

function parseInventoryFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    return {
      valid: [],
      invalid: [],
      stats: { total: 0, valid: 0, invalid: 0 }
    };
  }

  const records = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      return;
    }

    if (index === 0) {
      const headers = trimmedLine.split(',').map(h => h.trim());
      const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
      if (missingFields.length > 0) {
        invalidLines.push({
          lineNumber,
          content: trimmedLine,
          reason: `缺少必需字段: ${missingFields.join(', ')}`
        });
      }
      return;
    }

    try {
      const parsed = parse(trimmedLine, {
        columns: REQUIRED_FIELDS,
        skip_empty_lines: true,
        trim: true
      });

      if (parsed.length === 1) {
        const record = parsed[0];
        record.lineNumber = lineNumber;
        records.push(record);
      } else {
        invalidLines.push({
          lineNumber,
          content: trimmedLine,
          reason: '字段数量不匹配'
        });
      }
    } catch (e) {
      invalidLines.push({
        lineNumber,
        content: trimmedLine,
        reason: `解析错误: ${e.message}`
      });
    }
  });

  const validRecords = records.filter(r => {
    return r['装备编号'] && r['装备名称'] && r['数量'];
  });

  return {
    valid: validRecords,
    invalid: invalidLines,
    stats: {
      total: lines.filter(l => l.trim() !== '').length - 1,
      valid: validRecords.length,
      invalid: invalidLines.length
    }
  };
}

function parseDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(dirPath, f));

  if (files.length === 0) {
    return {
      files: [],
      allValid: [],
      allInvalid: [],
      stats: { totalFiles: 0, totalRecords: 0, validRecords: 0, invalidRecords: 0 }
    };
  }

  const allValid = [];
  const allInvalid = [];
  const fileResults = [];

  files.forEach(file => {
    const result = parseInventoryFile(file);
    fileResults.push({ file, ...result });
    allValid.push(...result.valid);
    allInvalid.push(...result.invalid);
  });

  return {
    files: fileResults,
    allValid,
    allInvalid,
    stats: {
      totalFiles: files.length,
      totalRecords: allValid.length + allInvalid.length,
      validRecords: allValid.length,
      invalidRecords: allInvalid.length
    }
  };
}

module.exports = {
  parseInventoryFile,
  parseDirectory,
  REQUIRED_FIELDS
};
