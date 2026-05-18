const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const REQUIRED_FIELDS = [
  '资产编号',
  '资产名称',
  '借用人工号',
  '借用人姓名',
  '借用部门',
  '借用日期',
  '应归还日期',
  '实际归还日期',
  '资产状态'
];

async function parseDirectory(inputPath) {
  const results = {
    files: [],
    errors: [],
    data: []
  };

  if (!fs.existsSync(inputPath)) {
    results.errors.push({
      type: 'PATH_NOT_EXISTS',
      message: `路径不存在: ${inputPath}`,
      severity: 'critical'
    });
    return results;
  }

  const stat = fs.statSync(inputPath);
  
  if (stat.isFile()) {
    const fileResult = await parseFile(inputPath);
    results.files.push({
      fileName: path.basename(inputPath),
      success: fileResult.errors.length === 0,
      recordCount: fileResult.data.length,
      errors: fileResult.errors
    });

    if (fileResult.data.length > 0) {
      results.data.push(...fileResult.data);
    }
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(inputPath)
      .filter(file => file.endsWith('.csv') || file.endsWith('.xlsx') || file.endsWith('.xls'));

    if (files.length === 0) {
      results.errors.push({
        type: 'EMPTY_DIRECTORY',
        message: `目录为空，没有找到 CSV 或 Excel 文件: ${inputPath}`,
        severity: 'warning'
      });
      return results;
    }

    for (const file of files) {
      const filePath = path.join(inputPath, file);
      const fileResult = await parseFile(filePath);
      results.files.push({
        fileName: file,
        success: fileResult.errors.length === 0,
        recordCount: fileResult.data.length,
        errors: fileResult.errors
      });

      if (fileResult.data.length > 0) {
        results.data.push(...fileResult.data);
      }
    }
  }

  return results;
}

async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (ext === '.csv') {
    return parseCsvFile(filePath, fileName);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseExcelFile(filePath, fileName);
  }

  return {
    data: [],
    errors: [{
      type: 'UNSUPPORTED_FORMAT',
      message: `不支持的文件格式: ${ext}`,
      fileName,
      severity: 'error'
    }]
  };
}

function parseCsvFile(filePath, fileName) {
  return new Promise((resolve) => {
    const results = {
      data: [],
      errors: []
    };

    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingFields.length > 0) {
          results.errors.push({
            type: 'MISSING_COLUMNS',
            message: `缺少必要字段: ${missingFields.join(', ')}`,
            fileName,
            severity: 'error'
          });
        }
      })
      .on('data', (row) => {
        results.data.push({
          ...row,
          _sourceFile: fileName,
          _rowNumber: results.data.length + 2
        });
      })
      .on('error', (error) => {
        results.errors.push({
          type: 'FILE_CORRUPTED',
          message: `文件读取失败: ${error.message}`,
          fileName,
          severity: 'error'
        });
        resolve(results);
      })
      .on('end', () => {
        resolve(results);
      });

    setTimeout(() => {
      if (!stream.closed) {
        stream.destroy();
        results.errors.push({
          type: 'FILE_TIMEOUT',
          message: '文件读取超时',
          fileName,
          severity: 'error'
        });
        resolve(results);
      }
    }, 30000);
  });
}

function parseExcelFile(filePath, fileName) {
  const results = {
    data: [],
    errors: []
  };

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (jsonData.length > 0) {
      const headers = Object.keys(jsonData[0]);
      const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
      if (missingFields.length > 0) {
        results.errors.push({
          type: 'MISSING_COLUMNS',
          message: `缺少必要字段: ${missingFields.join(', ')}`,
          fileName,
          severity: 'error'
        });
      }
    }

    jsonData.forEach((row, index) => {
      results.data.push({
        ...row,
        _sourceFile: fileName,
        _rowNumber: index + 2
      });
    });
  } catch (error) {
    results.errors.push({
      type: 'FILE_CORRUPTED',
      message: `Excel 文件读取失败: ${error.message}`,
      fileName,
      severity: 'error'
    });
  }

  return results;
}

module.exports = {
  parseDirectory,
  parseFile,
  REQUIRED_FIELDS
};
