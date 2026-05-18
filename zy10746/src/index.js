const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const crypto = require('crypto');

const EXCEPTION_TYPES = {
  ACCOMMODATION_EXCEED: '住宿超标',
  FLIGHT_REBOOK: '机票改签',
  CITY_LEVEL: '城市等级不符',
  OTHER: '其他例外'
};

const REQUIRED_FIELDS = [
  '员工姓名',
  '员工编号',
  '申请日期',
  '例外类型',
  '例外原因',
  '审批状态'
];

function generateFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

async function readCSVFile(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function readExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

function readJSONFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

async function readDataFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  console.log(`  📄 读取文件: ${fileName}`);
  
  let data;
  switch (ext) {
    case '.csv':
      data = await readCSVFile(filePath);
      break;
    case '.xlsx':
    case '.xls':
      data = readExcelFile(filePath);
      break;
    case '.json':
      data = readJSONFile(filePath);
      if (!Array.isArray(data)) {
        data = [data];
      }
      break;
    default:
      throw new Error(`不支持的文件格式: ${ext}`);
  }
  
  return data.map((row, index) => ({
    ...row,
    _sourceFile: fileName,
    _sourceLine: index + 2
  }));
}

function classifyException(row) {
  const reason = (row['例外原因'] || row['reason'] || '').toString();
  const type = (row['例外类型'] || row['type'] || '').toString();
  
  if (type.includes('住宿') || reason.includes('住宿') || reason.includes('酒店')) {
    return EXCEPTION_TYPES.ACCOMMODATION_EXCEED;
  }
  if (type.includes('机票') || type.includes('改签') || reason.includes('机票') || reason.includes('改签')) {
    return EXCEPTION_TYPES.FLIGHT_REBOOK;
  }
  if (type.includes('城市') || type.includes('等级') || reason.includes('城市') || reason.includes('等级')) {
    return EXCEPTION_TYPES.CITY_LEVEL;
  }
  return EXCEPTION_TYPES.OTHER;
}

function validateRow(row, index) {
  const errors = [];
  const missingFields = [];
  
  for (const field of REQUIRED_FIELDS) {
    const value = row[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    errors.push(`缺少必填字段: ${missingFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    rowIndex: index
  };
}

async function processTravelExceptions(inputDir, outputDir) {
  const files = fs.readdirSync(inputDir);
  const dataFiles = files.filter(f => 
    ['.csv', '.xlsx', '.xls', '.json'].includes(path.extname(f).toLowerCase())
  );
  
  if (dataFiles.length === 0) {
    throw new Error('输入目录中未找到支持的数据文件 (.csv, .xlsx, .json)');
  }
  
  const allRecords = [];
  const invalidRecords = [];
  const stats = {
    totalFiles: dataFiles.length,
    successFiles: 0,
    failedFiles: 0,
    totalExceptions: 0
  };
  
  for (const file of dataFiles) {
    const filePath = path.join(inputDir, file);
    
    try {
      const records = await readDataFile(filePath);
      
      records.forEach((record) => {
        const validation = validateRow(record, record._sourceLine);
        
        if (validation.isValid) {
          record._classifiedType = classifyException(record);
          allRecords.push(record);
        } else {
          invalidRecords.push({
            ...record,
            _validationErrors: validation.errors
          });
        }
      });
      
      stats.successFiles++;
      console.log(`  ✅ 处理完成: ${file} (${records.length} 条记录)`);
      
    } catch (error) {
      stats.failedFiles++;
      console.log(`  ❌ 处理失败: ${file} - ${error.message}`);
    }
  }
  
  stats.totalExceptions = allRecords.length;
  
  const summaryByType = {};
  for (const type of Object.values(EXCEPTION_TYPES)) {
    summaryByType[type] = allRecords.filter(r => r._classifiedType === type);
  }
  
  return {
    allRecords,
    invalidRecords,
    summaryByType,
    stats
  };
}

function generateTextReport(result, outputDir) {
  const { allRecords, invalidRecords, summaryByType, stats } = result;
  
  let report = '══════════════════════════════════════════════════════════════\n';
  report += '                差旅政策表例外审批汇总报告                     \n';
  report += '══════════════════════════════════════════════════════════════\n\n';
  
  report += '【一、整体统计】\n';
  report += `  📊 处理文件总数: ${stats.totalFiles}\n`;
  report += `  ✅ 成功处理: ${stats.successFiles}\n`;
  report += `  ❌ 处理失败: ${stats.failedFiles}\n`;
  report += `  📝 有效例外记录: ${allRecords.length}\n`;
  report += `  ⚠️  无效记录: ${invalidRecords.length}\n\n`;
  
  report += '【二、例外类型汇总】\n';
  for (const [type, records] of Object.entries(summaryByType)) {
    report += `\n  📌 ${type} (${records.length} 条)\n`;
    report += `  ──────────────────────────────────────\n`;
    
    if (records.length > 0) {
      const reasonSummary = {};
      records.forEach(record => {
        const reason = record['例外原因'] || '未填写';
        reasonSummary[reason] = (reasonSummary[reason] || 0) + 1;
      });
      
      const sortedReasons = Object.entries(reasonSummary)
        .sort((a, b) => b[1] - a[1]);
      
      sortedReasons.forEach(([reason, count]) => {
        const percent = ((count / records.length) * 100).toFixed(1);
        report += `    • ${reason}: ${count} 条 (${percent}%)\n`;
      });
      
      report += `\n    明细来源:\n`;
      records.slice(0, 10).forEach(record => {
        report += `      - ${record['员工姓名'] || '未知'} (${record._sourceFile}:第${record._sourceLine}行)\n`;
      });
      if (records.length > 10) {
        report += `      ... 还有 ${records.length - 10} 条记录\n`;
      }
    } else {
      report += `    (无此类例外)\n`;
    }
  }
  
  if (invalidRecords.length > 0) {
    report += `\n\n【三、无效记录详情】\n`;
    invalidRecords.slice(0, 20).forEach((record, index) => {
      report += `\n  ${index + 1}. ${record._sourceFile}:第${record._sourceLine}行\n`;
      report += `     错误: ${record._validationErrors.join('; ')}\n`;
    });
    if (invalidRecords.length > 20) {
      report += `\n  ... 还有 ${invalidRecords.length - 20} 条无效记录\n`;
    }
  }
  
  report += '\n══════════════════════════════════════════════════════════════\n';
  report += `                    报告生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  report += '══════════════════════════════════════════════════════════════\n';
  
  const reportFile = path.join(outputDir, '差旅政策例外审批汇总报告.txt');
  fs.writeFileSync(reportFile, report, 'utf8');
  
  return {
    fileName: '差旅政策例外审批汇总报告.txt',
    description: '汇总报告主文件，包含整体统计、例外类型汇总、原因分析和明细来源',
    fullPath: reportFile
  };
}

function generateDetailedCSV(result, outputDir) {
  const { allRecords } = result;
  
  const headers = [
    '员工姓名',
    '员工编号',
    '申请日期',
    '例外类型',
    '分类后例外类型',
    '例外原因',
    '审批状态',
    '原始文件名',
    '原始行号'
  ];
  
  const csvContent = [
    headers.join(','),
    ...allRecords.map(record => [
      `"${record['员工姓名'] || ''}"`,
      `"${record['员工编号'] || ''}"`,
      `"${record['申请日期'] || ''}"`,
      `"${record['例外类型'] || ''}"`,
      `"${record._classifiedType}"`,
      `"${(record['例外原因'] || '').replace(/"/g, '""')}"`,
      `"${record['审批状态'] || ''}"`,
      `"${record._sourceFile}"`,
      record._sourceLine
    ].join(','))
  ].join('\n');
  
  const csvFile = path.join(outputDir, '差旅政策例外审批明细.csv');
  fs.writeFileSync(csvFile, csvContent, 'utf8');
  
  return {
    fileName: '差旅政策例外审批明细.csv',
    description: '详细数据CSV文件，包含所有有效例外记录的完整信息和原始来源',
    fullPath: csvFile
  };
}

function generateErrorReport(result, outputDir) {
  const { invalidRecords } = result;
  
  if (invalidRecords.length === 0) {
    return null;
  }
  
  const headers = [
    '原始文件名',
    '原始行号',
    '错误信息',
    '员工姓名',
    '员工编号'
  ];
  
  const csvContent = [
    headers.join(','),
    ...invalidRecords.map(record => [
      `"${record._sourceFile}"`,
      record._sourceLine,
      `"${record._validationErrors.join('; ').replace(/"/g, '""')}"`,
      `"${record['员工姓名'] || ''}"`,
      `"${record['员工编号'] || ''}"`
    ].join(','))
  ].join('\n');
  
  const errorFile = path.join(outputDir, '无效记录错误报告.csv');
  fs.writeFileSync(errorFile, csvContent, 'utf8');
  
  return {
    fileName: '无效记录错误报告.csv',
    description: '数据校验错误报告，包含所有无效记录的错误信息和原始位置',
    fullPath: errorFile
  };
}

async function generateReports(result, outputDir) {
  const reports = [];
  
  console.log('');
  console.log('📝 正在生成报告文件...');
  
  reports.push(generateTextReport(result, outputDir));
  console.log('  ✅ 生成文本汇总报告');
  
  reports.push(generateDetailedCSV(result, outputDir));
  console.log('  ✅ 生成明细CSV文件');
  
  const errorReport = generateErrorReport(result, outputDir);
  if (errorReport) {
    reports.push(errorReport);
    console.log('  ✅ 生成错误报告');
  }
  
  return reports;
}

module.exports = {
  processTravelExceptions,
  generateReports,
  EXCEPTION_TYPES,
  REQUIRED_FIELDS
};
