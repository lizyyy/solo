function checkMissingColumns(headers, requiredColumns) {
  const missing = requiredColumns.filter(col => !headers.includes(col));
  return {
    hasMissing: missing.length > 0,
    missingColumns: missing
  };
}

function findDuplicateRows(rows, checkColumns) {
  const seen = new Map();
  const duplicates = [];
  
  rows.forEach((row, index) => {
    const key = checkColumns.map(col => row[col] || '').join('|');
    if (seen.has(key)) {
      duplicates.push({
        rowIndex: index + 2,
        rowData: row,
        duplicateWith: seen.get(key)
      });
    } else {
      seen.set(key, index + 2);
    }
  });
  
  return {
    hasDuplicates: duplicates.length > 0,
    duplicates: duplicates
  };
}

function validateRow(row, rowIndex, config) {
  const errors = [];
  
  for (const col of config.requiredColumns) {
    if (!row[col] || row[col].toString().trim() === '') {
      errors.push({
        type: 'missing_value',
        column: col,
        message: `第 ${rowIndex} 行缺少必填列 "${col}" 的值`
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function validateBulbLife(row, config) {
  const bulbHours = parseInt(row['灯泡使用时长']);
  const issues = [];
  
  if (!isNaN(bulbHours)) {
    if (bulbHours >= config.validation.maxBulbHours) {
      issues.push({
        type: 'bulb_replace',
        severity: 'critical',
        message: `灯泡已使用 ${bulbHours} 小时，达到更换阈值 ${config.validation.maxBulbHours} 小时，需要立即更换`
      });
    } else if (bulbHours >= config.validation.warningBulbHours) {
      issues.push({
        type: 'bulb_warning',
        severity: 'warning',
        message: `灯泡已使用 ${bulbHours} 小时，接近更换阈值，建议安排更换`
      });
    }
  }
  
  return {
    hasIssues: issues.length > 0,
    issues: issues
  };
}

module.exports = {
  checkMissingColumns,
  findDuplicateRows,
  validateRow,
  validateBulbLife
};
