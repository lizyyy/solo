import csvParser from 'csv-parser';
import fs from 'fs';
import xlsx from 'xlsx';

const REQUIRED_FIELDS = [
  '流水号',
  '入场时间',
  '出场时间',
  '车牌号',
  '停车时长',
  '应收金额',
  '实收金额',
  '支付方式',
  '车道编号',
  '车道状态',
  '照片数量'
];

export function parseFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    return parseCSV(filePath);
  } else if (['xlsx', 'xls'].includes(ext)) {
    return parseExcel(filePath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const parseErrors = [];
    let lineNumber = 1;

    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .on('error', reject)
      .pipe(csvParser())
      .on('headers', (headers) => {
        const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingFields.length > 0) {
          parseErrors.push({
            type: '缺失必填字段',
            message: `CSV文件缺失必填字段: ${missingFields.join(', ')}`
          });
        }
      })
      .on('data', (data) => {
        lineNumber++;
        try {
          const record = normalizeRecord(data, lineNumber);
          results.push(record);
        } catch (error) {
          parseErrors.push({
            type: '数据格式错误',
            lineNumber,
            message: error.message,
            rawData: data
          });
        }
      })
      .on('end', () => {
        resolve({ records: results, parseErrors });
      })
      .on('error', reject);
  });
}

function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const results = [];
  const parseErrors = [];

  const headers = Object.keys(data[0] || {});
  const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
  if (missingFields.length > 0) {
    parseErrors.push({
      type: '缺失必填字段',
      message: `Excel文件缺失必填字段: ${missingFields.join(', ')}`
    });
  }

  data.forEach((row, index) => {
    const lineNumber = index + 2;
    try {
      const record = normalizeRecord(row, lineNumber);
      results.push(record);
    } catch (error) {
      parseErrors.push({
        type: '数据格式错误',
        lineNumber,
        message: error.message,
        rawData: row
      });
    }
  });

  return Promise.resolve({ records: results, parseErrors });
}

function normalizeRecord(data, lineNumber) {
  const record = {
    流水号: String(data['流水号'] || '').trim(),
    入场时间: parseDateTime(data['入场时间']),
    出场时间: parseDateTime(data['出场时间']),
    车牌号: String(data['车牌号'] || '').trim(),
    停车时长: parseDuration(data['停车时长']),
    应收金额: parseAmount(data['应收金额']),
    实收金额: parseAmount(data['实收金额']),
    支付方式: String(data['支付方式'] || '').trim(),
    车道编号: String(data['车道编号'] || '').trim(),
    车道状态: String(data['车道状态'] || '').trim(),
    照片数量: parseInt(data['照片数量'] || '0', 10),
    原始行号: lineNumber
  };

  if (!record.流水号) {
    throw new Error('流水号不能为空');
  }

  return record;
}

function parseDateTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error(`时间格式无效: ${str}`);
  }
  return date.toISOString();
}

function parseDuration(value) {
  if (!value) return 0;
  const str = String(value).trim();
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseAmount(value) {
  if (!value) return 0;
  const str = String(value).trim().replace(/[^0-9.]/g, '');
  return parseFloat(str) || 0;
}
