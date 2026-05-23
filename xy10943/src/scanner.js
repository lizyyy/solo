const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic'];

async function scanDirectory(dirPath, recursive = true) {
  const results = [];
  
  async function scan(currentPath, relativePath = '') {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        await scan(fullPath, entryRelativePath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const stats = await fs.promises.stat(fullPath);
          results.push({
            name: entry.name,
            path: fullPath,
            relativePath: entryRelativePath,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            extension: ext
          });
        }
      }
    }
  }
  
  await scan(dirPath);
  return results;
}

function parseFilename(filename, filePath = '') {
  const result = {
    valid: false,
    filename,
    filePath,
    customerId: null,
    workOrderId: null,
    photoType: null,
    index: null,
    error: null,
    raw: filename
  };
  
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  
  const PHOTO_TYPE_PATTERN = '(before|after|repair|inspection|维修前|维修后|维修中|检查)';
  
  const patterns = [
    {
      regex: new RegExp(`^C(\\d+)[_-]WO(\\d+)[_-]${PHOTO_TYPE_PATTERN}[_-]?(\\d+)?$`, 'i'),
      mapping: ['customerId', 'workOrderId', 'photoType', 'index']
    },
    {
      regex: new RegExp(`^客户([A-Za-z0-9]+)[_-]工单(\\d+)[_-]?${PHOTO_TYPE_PATTERN}[_-]?(\\d+)?$`, 'i'),
      mapping: ['customerId', 'workOrderId', 'photoType', 'index']
    },
    {
      regex: new RegExp(`^([A-Za-z0-9]+)[_-](WO\\d+|WK\\d+|\\d+)[_-]${PHOTO_TYPE_PATTERN}[_-]?(\\d+)?$`, 'i'),
      mapping: ['customerId', 'workOrderId', 'photoType', 'index']
    },
    {
      regex: new RegExp(`^([A-Za-z0-9]+)[_-]${PHOTO_TYPE_PATTERN}[_-](WO\\d+|WK\\d+|\\d+)[_-]?(\\d+)?$`, 'i'),
      mapping: ['customerId', 'photoType', 'workOrderId', 'index']
    },
    {
      regex: new RegExp(`^(WO\\d+|WK\\d+|\\d+)[_-]([A-Za-z0-9]+)[_-]${PHOTO_TYPE_PATTERN}[_-]?(\\d+)?$`, 'i'),
      mapping: ['workOrderId', 'customerId', 'photoType', 'index']
    },
    {
      regex: new RegExp(`^([A-Za-z0-9]+)[_-](WO\\d+|WK\\d+|\\d+)[_-]?(\\d+)?[_-]${PHOTO_TYPE_PATTERN}$`, 'i'),
      mapping: ['customerId', 'workOrderId', 'index', 'photoType']
    }
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern.regex);
    if (match) {
      result.valid = true;
      pattern.mapping.forEach((field, i) => {
        if (match[i + 1]) {
          if (field === 'photoType') {
            result[field] = normalizePhotoType(match[i + 1]);
          } else if (field === 'index') {
            result[field] = parseInt(match[i + 1], 10);
          } else {
            result[field] = match[i + 1].toUpperCase();
          }
        }
      });
      break;
    }
  }
  
  if (!result.valid) {
    result.error = detectParseIssue(nameWithoutExt);
  }
  
  return result;
}

function normalizePhotoType(type) {
  const typeMap = {
    'before': 'before',
    '维修前': 'before',
    'repair_before': 'before',
    'pre': 'before',
    'after': 'after',
    '维修后': 'after',
    'repair_after': 'after',
    'post': 'after',
    'repair': 'repair',
    '维修中': 'repair',
    'inspection': 'inspection',
    '检查': 'inspection'
  };
  return typeMap[type.toLowerCase()] || typeMap[type] || type.toLowerCase();
}

function detectParseIssue(name) {
  if (!name) return '文件名为空';
  if (name.length < 5) return '文件名太短，无法解析';
  if (!/[A-Za-z0-9]/.test(name)) return '文件名不含字母数字';
  
  const hasCustomer = /客户|C\d+/i.test(name);
  const hasWorkOrder = /工单|WO\d+|WK\d+/i.test(name);
  const hasType = /before|after|维修|repair/i.test(name);
  
  const missing = [];
  if (!hasCustomer) missing.push('客户标识');
  if (!hasWorkOrder) missing.push('工单标识');
  if (!hasType) missing.push('照片类型');
  
  if (missing.length > 0) {
    return `缺少: ${missing.join(', ')}`;
  }
  
  return '命名格式不匹配';
}

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

module.exports = {
  scanDirectory,
  parseFilename,
  calculateFileHash,
  IMAGE_EXTENSIONS
};
