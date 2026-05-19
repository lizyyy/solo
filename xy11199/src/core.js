const fs = require('fs');
const path = require('path');

const PHOTO_STATUS = {
  PENDING: '待处理',
  DELIVERED: '已交付',
  RESHOOT: '需补拍',
  RESHOOT_COMPLETED: '补拍完成',
  FAILED: '处理失败'
};

const LOCATIONS = ['三亚', '丽江', '大理', '厦门', '青岛', '巴厘岛', '马尔代夫'];

function parseCSV(content, sourceFile) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record = {
      _source: {
        file: sourceFile,
        line: i + 1
      }
    };

    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });

    records.push(record);
  }

  return records;
}

function parseJSON(content, sourceFile) {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    ...item,
    _source: {
      file: sourceFile,
      line: index + 1
    }
  }));
}

function readFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(content, filePath);
  } else if (ext === '.json') {
    return parseJSON(content, filePath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }
}

function resolveDuplicateLocations(records) {
  const fileNameGroups = new Map();

  records.forEach(record => {
    const fileName = record['文件名'] || record['fileName'] || '';
    const location = record['拍摄地点'] || record['location'] || '未知';
    const key = fileName;

    if (!fileNameGroups.has(key)) {
      fileNameGroups.set(key, []);
    }
    fileNameGroups.get(key).push({ ...record, _location: location });
  });

  const resolved = [];
  fileNameGroups.forEach((group, fileName) => {
    const uniqueLocations = new Set(group.map(r => r._location));
    
    if (uniqueLocations.size === 1) {
      group.forEach(record => {
        const location = record._location;
        delete record._location;
        resolved.push({
          ...record,
          _uniqueId: `${fileName}-${location}`,
          _duplicateResolved: false,
          _sameFileNameDifferentLocations: false
        });
      });
    } else {
      group.forEach((record, idx) => {
        const location = record._location;
        delete record._location;
        resolved.push({
          ...record,
          _uniqueId: `${fileName}-${location}-${idx + 1}`,
          _duplicateResolved: true,
          _duplicateCount: group.length,
          _duplicateIndex: idx + 1,
          _sameFileNameDifferentLocations: true,
          _locations: Array.from(uniqueLocations)
        });
      });
    }
  });

  return resolved;
}

function trackReshoots(records) {
  const orderGroups = new Map();

  records.forEach(record => {
    const orderId = record['订单号'] || record['orderId'] || '';
    if (!orderGroups.has(orderId)) {
      orderGroups.set(orderId, []);
    }
    orderGroups.get(orderId).push(record);
  });

  return records.map(record => {
    const orderId = record['订单号'] || record['orderId'] || '';
    const group = orderGroups.get(orderId) || [];
    const isReshoot = record['是否补拍'] === '是' || record['isReshoot'] === true;
    const reshootCount = group.filter(r => 
      r['是否补拍'] === '是' || r['isReshoot'] === true
    ).length;

    return {
      ...record,
      _reshootInfo: {
        isReshoot,
        reshootNumber: isReshoot ? reshootCount : 0,
        totalReshoots: reshootCount,
        hasMultipleReshoots: reshootCount > 1
      }
    };
  });
}

function validateFields(records) {
  const requiredFields = ['订单号', '文件名', '拍摄地点', '客户姓名'];
  const results = [];

  records.forEach(record => {
    const missingFields = requiredFields.filter(field => !record[field]);
    const isEmpty = Object.values(record).every(v => !v || (typeof v === 'string' && !v.trim()));

    results.push({
      ...record,
      _validation: {
        isValid: missingFields.length === 0 && !isEmpty,
        missingFields,
        isEmpty,
        status: missingFields.length === 0 ? PHOTO_STATUS.PENDING : PHOTO_STATUS.FAILED
      }
    });
  });

  return results;
}

function removeDuplicates(records) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  records.forEach(record => {
    const key = [
      record['订单号'],
      record['文件名'],
      record['拍摄地点']
    ].join('|');

    if (seen.has(key)) {
      duplicates.push({
        ...record,
        _isDuplicate: true
      });
    } else {
      seen.add(key);
      unique.push({
        ...record,
        _isDuplicate: false
      });
    }
  });

  return { unique, duplicates };
}

function toCSV(records) {
  if (records.length === 0) return '';

  const allKeys = new Set();
  records.forEach(r => {
    Object.keys(r).forEach(k => {
      if (!k.startsWith('_')) allKeys.add(k);
    });
  });

  const metaKeys = ['_source.file', '_source.line', '_uniqueId', '_duplicateResolved', 
                    '_reshootInfo.isReshoot', '_reshootInfo.reshootNumber',
                    '_validation.isValid', '_validation.status'];
  
  const headers = [...allKeys, ...metaKeys];
  
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  };

  const rows = records.map(record => {
    return headers.map(h => {
      if (h.startsWith('_')) {
        return escapeCSV(getNestedValue(record, h) ?? '');
      }
      return escapeCSV(record[h] ?? '');
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function toJSON(records, pretty = true) {
  return pretty ? JSON.stringify(records, null, 2) : JSON.stringify(records);
}

function toMarkdown(records) {
  if (records.length === 0) return '无数据';

  const mainFields = ['订单号', '客户姓名', '拍摄地点', '文件名', '拍摄日期', '状态'];
  const metaFields = ['源文件', '行号', '补拍次数', '验证状态'];

  const headers = [...mainFields, ...metaFields];
  
  const rows = records.map(record => {
    const values = [
      record['订单号'] || '-',
      record['客户姓名'] || '-',
      record['拍摄地点'] || '-',
      record['文件名'] || '-',
      record['拍摄日期'] || '-',
      record._validation?.status || '-',
      record._source?.file ? path.basename(record._source.file) : '-',
      record._source?.line || '-',
      record._reshootInfo?.reshootNumber || '-',
      record._validation?.isValid ? '✓' : '✗'
    ];
    return '| ' + values.join(' | ') + ' |';
  });

  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
  
  return [
    '| ' + headers.join(' | ') + ' |',
    separator,
    ...rows
  ].join('\n');
}

function processFiles(filePaths, options = {}) {
  const results = [];
  const errors = [];
  const stats = {
    totalFiles: filePaths.length,
    processedFiles: 0,
    failedFiles: 0,
    totalRecords: 0,
    validRecords: 0,
    duplicateRecords: 0,
    reshootRecords: 0
  };

  filePaths.forEach(filePath => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const statsObj = fs.statSync(filePath);
      if (statsObj.size === 0) {
        errors.push({
          file: filePath,
          error: '文件为空',
          skipped: true
        });
        stats.failedFiles++;
        return;
      }

      const records = readFile(filePath);
      stats.totalRecords += records.length;

      let processed = validateFields(records);
      processed = trackReshoots(processed);
      processed = resolveDuplicateLocations(processed);

      const { unique, duplicates } = removeDuplicates(processed);
      stats.duplicateRecords += duplicates.length;
      stats.validRecords += unique.filter(r => r._validation?.isValid).length;
      stats.reshootRecords += unique.filter(r => r._reshootInfo?.isReshoot).length;

      results.push(...unique);
      stats.processedFiles++;
    } catch (error) {
      errors.push({
        file: filePath,
        error: error.message
      });
      stats.failedFiles++;
      
      if (!options.continueOnError) {
        throw error;
      }
    }
  });

  return {
    data: results,
    errors,
    stats,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  PHOTO_STATUS,
  LOCATIONS,
  parseCSV,
  parseJSON,
  readFile,
  resolveDuplicateLocations,
  trackReshoots,
  validateFields,
  removeDuplicates,
  toCSV,
  toJSON,
  toMarkdown,
  processFiles
};
