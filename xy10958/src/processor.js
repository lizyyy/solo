const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { SIZE_MAPPINGS, HEADER_VARIANTS, REQUIRED_FIELDS, VALID_SIZES } = require('./constants');

function normalizeSize(size) {
  if (!size) return '';
  const cleanSize = String(size).trim();
  return SIZE_MAPPINGS[cleanSize] || cleanSize;
}

function isValidSize(size) {
  return VALID_SIZES.includes(size);
}

function mapHeaders(headers) {
  const mapping = {};
  for (const [standardField, variants] of Object.entries(HEADER_VARIANTS)) {
    for (const header of headers) {
      const cleanHeader = String(header).trim();
      if (variants.some(v => cleanHeader.includes(v) || v.includes(cleanHeader))) {
        mapping[header] = standardField;
        break;
      }
    }
  }
  return mapping;
}

function validateRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push(`缺少${field === 'name' ? '姓名' : field === 'className' ? '班级' : '尺码'}信息`);
    }
  }

  if (row.size) {
    const normalized = normalizeSize(row.size);
    if (!isValidSize(normalized)) {
      warnings.push(`尺码 "${row.size}" 不在标准范围内，已保留原始值`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        return reject(new Error('Excel文件为空或只有表头'));
      }

      const headers = jsonData[0];
      const headerMapping = mapHeaders(headers);
      const results = [];
      const badRows = [];

      for (let i = 1; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        const row = {};
        headers.forEach((header, idx) => {
          const field = headerMapping[header] || header;
          row[field] = rowData[idx];
        });

        const validation = validateRow(row, i + 1);
        const normalizedSize = normalizeSize(row.size);

        results.push({
          originalRow: i + 1,
          name: row.name ? String(row.name).trim() : '',
          className: row.className ? String(row.className).trim() : '',
          size: normalizedSize,
          originalSize: row.size,
          supplement: row.supplement ? String(row.supplement).trim() : '',
          remark: row.remark ? String(row.remark).trim() : '',
          validation,
        });

        if (!validation.valid) {
          badRows.push({
            row: i + 1,
            data: row,
            errors: validation.errors,
            warnings: validation.warnings,
          });
        }
      }

      resolve({ data: results, badRows, headers });
    } catch (error) {
      reject(error);
    }
  });
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const badRows = [];
    let headers = [];
    let headerMapping = {};
    let rowIndex = 1;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        headerMapping = mapHeaders(headerList);
      })
      .on('data', (data) => {
        rowIndex++;
        const row = {};
        for (const [originalHeader, value] of Object.entries(data)) {
          const field = headerMapping[originalHeader] || originalHeader;
          row[field] = value;
        }

        const validation = validateRow(row, rowIndex);
        const normalizedSize = normalizeSize(row.size);

        results.push({
          originalRow: rowIndex,
          name: row.name ? String(row.name).trim() : '',
          className: row.className ? String(row.className).trim() : '',
          size: normalizedSize,
          originalSize: row.size,
          supplement: row.supplement ? String(row.supplement).trim() : '',
          remark: row.remark ? String(row.remark).trim() : '',
          validation,
        });

        if (!validation.valid) {
          badRows.push({
            row: rowIndex,
            data: row,
            errors: validation.errors,
            warnings: validation.warnings,
          });
        }
      })
      .on('end', () => {
        if (results.length === 0) {
          return reject(new Error('CSV文件为空'));
        }
        resolve({ data: results, badRows, headers });
      })
      .on('error', reject);
  });
}

async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath);
  } else if (ext === '.csv') {
    return parseCSV(filePath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}，请使用 CSV 或 Excel 文件`);
  }
}

function mergeDuplicates(data) {
  const studentMap = new Map();
  const duplicates = [];

  for (const record of data) {
    if (!record.name || !record.className) continue;
    const key = `${record.name}|${record.className}`;

    if (studentMap.has(key)) {
      const existing = studentMap.get(key);
      duplicates.push({
        name: record.name,
        className: record.className,
        originalRows: [existing.originalRow, record.originalRow],
        sizes: [existing.size, record.size],
      });

      if (record.remark) {
        existing.remark = existing.remark 
          ? `${existing.remark}; ${record.remark}` 
          : record.remark;
      }

      if (record.size !== existing.size) {
        existing.remark = existing.remark 
          ? `${existing.remark}; 尺码冲突: ${existing.size}/${record.size}` 
          : `尺码冲突: ${existing.size}/${record.size}`;
      }

      if (record.supplement && !existing.supplement) {
        existing.supplement = record.supplement;
      }
    } else {
      studentMap.set(key, { ...record });
    }
  }

  return {
    mergedData: Array.from(studentMap.values()),
    duplicates,
  };
}

function summarizeByClassAndSize(data) {
  const classSummary = new Map();
  const sizeSummary = new Map();
  const classSizeMatrix = new Map();

  for (const record of data) {
    if (!record.className || !record.size) continue;

    if (!classSummary.has(record.className)) {
      classSummary.set(record.className, { count: 0, sizes: new Map() });
    }
    const classData = classSummary.get(record.className);
    classData.count++;
    classData.sizes.set(record.size, (classData.sizes.get(record.size) || 0) + 1);

    sizeSummary.set(record.size, (sizeSummary.get(record.size) || 0) + 1);

    if (!classSizeMatrix.has(record.className)) {
      classSizeMatrix.set(record.className, new Map());
    }
    const sizeMap = classSizeMatrix.get(record.className);
    sizeMap.set(record.size, (sizeMap.get(record.size) || 0) + 1);
  }

  return {
    byClass: Object.fromEntries(
      Array.from(classSummary.entries()).map(([className, data]) => [
        className,
        {
          total: data.count,
          sizes: Object.fromEntries(data.sizes.entries()),
        },
      ])
    ),
    bySize: Object.fromEntries(sizeSummary.entries()),
    matrix: Object.fromEntries(
      Array.from(classSizeMatrix.entries()).map(([className, sizes]) => [
        className,
        Object.fromEntries(sizes.entries()),
      ])
    ),
  };
}

module.exports = {
  parseFile,
  normalizeSize,
  isValidSize,
  validateRow,
  mergeDuplicates,
  summarizeByClassAndSize,
  mapHeaders,
};
