const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');

const REQUIRED_FIELDS = ['phone', 'name', 'amount', 'date'];
const FIELD_ALIASES = {
  '手机号': 'phone',
  '电话': 'phone',
  '手机号码': 'phone',
  '会员电话': 'phone',
  '姓名': 'name',
  '会员姓名': 'name',
  '名称': 'name',
  '金额': 'amount',
  '消费金额': 'amount',
  '消费': 'amount',
  '日期': 'date',
  '消费日期': 'date',
  '交易日期': 'date',
  '时间': 'date',
  '备注': 'note',
  '说明': 'note',
  '注释': 'note'
};

function normalizeFields(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const lowerKey = key.trim().toLowerCase();
    const aliasKey = key.trim();
    
    if (FIELD_ALIASES[aliasKey]) {
      normalized[FIELD_ALIASES[aliasKey]] = value;
    } else if (REQUIRED_FIELDS.includes(lowerKey)) {
      normalized[lowerKey] = value;
    } else if (FIELD_ALIASES[aliasKey.replace(/\s/g, '')]) {
      normalized[FIELD_ALIASES[aliasKey.replace(/\s/g, '')]] = value;
    } else {
      normalized[lowerKey] = value;
    }
  }
  return normalized;
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    
    if (!fs.existsSync(filePath)) {
      return reject({ type: 'file_missing', message: '文件不存在' });
    }
    
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('headers', (headers) => {
        const normalizedHeaders = headers.map(h => {
          const trimmed = h.trim();
          return FIELD_ALIASES[trimmed] || FIELD_ALIASES[trimmed.replace(/\s/g, '')] || trimmed.toLowerCase();
        });
        
        const missingFields = REQUIRED_FIELDS.filter(f => !normalizedHeaders.includes(f));
        if (missingFields.length > 0) {
          errors.push({
            type: 'field_missing',
            message: `CSV文件缺少必要字段: ${missingFields.join(', ')}。请确保包含以下字段: phone/手机号、name/姓名、amount/金额、date/日期`
          });
        }
      })
      .on('data', (data) => {
        const normalized = normalizeFields(data);
        results.push(normalized);
      })
      .on('end', () => {
        if (errors.length > 0) {
          reject(errors[0]);
        } else {
          resolve(results);
        }
      })
      .on('error', (err) => {
        reject({ type: 'parse_error', message: `CSV解析错误: ${err.message}` });
      });
  });
}

function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject({ type: 'file_missing', message: '文件不存在' });
    }
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (data.length > 0) {
        const firstRow = data[0];
        const headers = Object.keys(firstRow);
        const normalizedHeaders = headers.map(h => {
          const trimmed = h.trim();
          return FIELD_ALIASES[trimmed] || FIELD_ALIASES[trimmed.replace(/\s/g, '')] || trimmed.toLowerCase();
        });
        
        const missingFields = REQUIRED_FIELDS.filter(f => !normalizedHeaders.includes(f));
        if (missingFields.length > 0) {
          return reject({
            type: 'field_missing',
            message: `Excel文件缺少必要字段: ${missingFields.join(', ')}。请确保包含以下字段: phone/手机号、name/姓名、amount/金额、date/日期`
          });
        }
      }
      
      const results = data.map(row => normalizeFields(row));
      resolve(results);
    } catch (err) {
      reject({ type: 'parse_error', message: `Excel解析错误: ${err.message}` });
    }
  });
}

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.csv':
      return parseCSV(filePath);
    case '.xlsx':
    case '.xls':
      return parseExcel(filePath);
    default:
      return Promise.reject({ 
        type: 'unsupported_format', 
        message: '不支持的文件格式，请上传CSV或Excel文件(.csv, .xlsx, .xls)' 
      });
  }
}

function exportToExcel(records, outputPath) {
  const data = records.map(r => ({
    '手机号': r.phone,
    '姓名': r.name,
    '系统会员名': r.memberName || '-',
    '金额': r.amount,
    '日期': r.date,
    '备注': r.note || '-',
    '状态': getStatusText(r.status),
    '来源文件': r.importedFrom,
    '导入时间': r.importedAt
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '会员消费记录');
  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

function exportToCSV(records, outputPath) {
  const headers = ['手机号', '姓名', '系统会员名', '金额', '日期', '备注', '状态', '来源文件', '导入时间'];
  const rows = records.map(r => [
    r.phone,
    r.name,
    r.memberName || '-',
    r.amount,
    r.date,
    r.note || '-',
    getStatusText(r.status),
    r.importedFrom,
    r.importedAt
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  return outputPath;
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已拒绝'
  };
  return statusMap[status] || status;
}

module.exports = {
  parseFile,
  exportToExcel,
  exportToCSV,
  REQUIRED_FIELDS
};
