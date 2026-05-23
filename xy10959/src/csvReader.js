const fs = require('fs');
const csv = require('csv-parser');
const { validateRow } = require('./validator');

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const data = [];
    const errors = [];
    let headers = [];
    let rowIndex = 0;

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (row) => {
        rowIndex++;
        const normalizedRow = normalizeRow(row, rowIndex);
        const validation = validateRow(normalizedRow, rowIndex, headers);
        
        if (validation.valid) {
          data.push(normalizedRow);
        } else {
          errors.push({
            row: rowIndex,
            data: normalizedRow,
            issues: validation.issues
          });
        }
      })
      .on('end', () => {
        resolve({
          data,
          headers,
          errors,
          totalRows: rowIndex
        });
      })
      .on('error', (error) => {
        reject(new Error(`CSV读取失败: ${error.message}`));
      });
  });
}

function normalizeRow(row, rowIndex) {
  const result = {
    _rowIndex: rowIndex,
    _phoneNormalized: null,
    _emailNormalized: null,
    _companyNormalized: null
  };

  Object.keys(row).forEach(key => {
    result[key] = row[key] ? row[key].trim() : '';
  });

  if (result['手机号']) {
    result._phoneNormalized = result['手机号'].replace(/\D/g, '');
  }

  if (result['邮箱']) {
    result._emailNormalized = result['邮箱'].toLowerCase().trim();
  }

  if (result['公司名']) {
    result._companyNormalized = normalizeCompanyName(result['公司名']);
  }

  return result;
}

function normalizeCompanyName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/(?:有限公司|有限责任公司|股份有限公司|集团|公司|科技|贸易|实业)$/g, '')
    .replace(/[（\(].*?[）\)]/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
    .trim();
}

module.exports = {
  readCSV,
  normalizeRow,
  normalizeCompanyName
};
