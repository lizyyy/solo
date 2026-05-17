const fs = require('fs');
const csv = require('csv-parser');

function normalizeValue(value, options = {}) {
  if (value === null || value === undefined) {
    return '';
  }
  
  let normalized = String(value);
  
  if (options.trim !== false) {
    normalized = normalized.trim();
  }
  
  if (options.collapseSpaces !== false) {
    normalized = normalized.replace(/\s+/g, ' ');
  }
  
  if (options.toLowerCase) {
    normalized = normalized.toLowerCase();
  }
  
  if (options.removeNonPrintable) {
    normalized = normalized.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  return normalized;
}

function buildPrimaryKey(row, keyColumns, options) {
  const values = keyColumns.map(col => {
    const value = row[col] || '';
    return normalizeValue(value, options);
  });
  return values.join('|');
}

function analyzeCSV(filePath, keyColumns, options = {}) {
  return new Promise((resolve, reject) => {
    const results = {
      filePath,
      keyColumns,
      totalRows: 0,
      validRows: 0,
      duplicateGroups: {},
      badRows: [],
      nullKeyRows: [],
      allRows: []
    };
    
    const keyMap = new Map();
    let lineNumber = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        results.headers = headers;
        const missingColumns = keyColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
          reject(new Error(`主键列不存在: ${missingColumns.join(', ')}`));
        }
      })
      .on('data', (row) => {
        lineNumber++;
        results.totalRows++;
        results.allRows.push({ lineNumber, data: { ...row } });
        
        const keyValues = keyColumns.map(col => row[col]);
        const hasNullKey = keyValues.some(v => v === null || v === undefined || v === '');
        
        if (hasNullKey) {
          results.nullKeyRows.push({
            lineNumber,
            data: row,
            reason: '主键列为空'
          });
          results.badRows.push({
            lineNumber,
            data: row,
            reason: '主键列为空'
          });
        } else {
          const normalizedKey = buildPrimaryKey(row, keyColumns, options);
          const originalKey = keyColumns.map(col => row[col]).join('|');
          
          results.validRows++;
          
          if (keyMap.has(normalizedKey)) {
            if (!results.duplicateGroups[normalizedKey]) {
              const firstOccurrence = keyMap.get(normalizedKey);
              results.duplicateGroups[normalizedKey] = {
                normalizedKey,
                originalKeys: [firstOccurrence.originalKey],
                rows: [firstOccurrence],
                count: 1
              };
              results.badRows.push({
                lineNumber: firstOccurrence.lineNumber,
                data: firstOccurrence.data,
                reason: `主键重复 (归一化后: ${normalizedKey})`,
                normalizedKey,
                originalKey: firstOccurrence.originalKey
              });
            }
            const duplicateInfo = {
              lineNumber,
              data: row,
              originalKey,
              normalizedKey
            };
            results.duplicateGroups[normalizedKey].originalKeys.push(originalKey);
            results.duplicateGroups[normalizedKey].rows.push(duplicateInfo);
            results.duplicateGroups[normalizedKey].count++;
            results.badRows.push({
              lineNumber,
              data: row,
              reason: `主键重复 (归一化后: ${normalizedKey})`,
              normalizedKey,
              originalKey
            });
          } else {
            keyMap.set(normalizedKey, {
              lineNumber,
              data: row,
              originalKey,
              normalizedKey
            });
          }
        }
      })
      .on('end', () => {
        results.duplicateCount = Object.keys(results.duplicateGroups).length;
        results.duplicateRowsCount = results.badRows.filter(r => r.reason.includes('重复')).length;
        results.nullKeyCount = results.nullKeyRows.length;
        resolve(results);
      })
      .on('error', reject);
  });
}

module.exports = {
  normalizeValue,
  buildPrimaryKey,
  analyzeCSV
};
