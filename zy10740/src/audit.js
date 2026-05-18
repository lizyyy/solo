const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const chalk = require('chalk');

async function runAudit(inputPath, rules, outputDir, options) {
  console.log(chalk.magenta('开始巡检流程...'));
  console.log('');

  const csvFiles = await findCsvFiles(inputPath);
  
  if (csvFiles.length === 0) {
    console.log(chalk.yellow('⚠ 警告: 输入目录中未找到CSV文件'));
    return;
  }

  console.log(chalk.blue(`发现 ${csvFiles.length} 个CSV文件:`));
  csvFiles.forEach(f => console.log(`  - ${path.basename(f)}`));
  console.log('');

  const allRecords = [];
  const fileErrors = [];

  for (const file of csvFiles) {
    try {
      const records = await parseCsvFile(file, rules);
      records.forEach(r => {
        r._sourceFile = path.basename(file);
        allRecords.push(r);
      });
      console.log(chalk.green(`✓ ${path.basename(file)}: ${records.length} 条记录`));
    } catch (error) {
      fileErrors.push({ file: path.basename(file), error: error.message });
      console.log(chalk.red(`✗ ${path.basename(file)}: ${error.message}`));
    }
  }

  console.log('');
  console.log(chalk.blue(`总计读取 ${allRecords.length} 条有效记录`));
  
  if (fileErrors.length > 0) {
    console.log(chalk.red(`遇到 ${fileErrors.length} 个文件解析错误`));
  }

  console.log('');
  console.log(chalk.magenta('开始业务规则分析...'));
  console.log('');

  const analysis = analyzeRecords(allRecords, rules);

  printAnalysisSummary(analysis);

  if (!options.dryRun) {
    await writeOutputFiles(outputDir, analysis, rules, options);
    console.log('');
    console.log(chalk.green(`输出文件已写入: ${outputDir}`));
  } else {
    console.log('');
    console.log(chalk.yellow('试运行模式，未写入输出文件'));
  }

  return { analysis, fileErrors };
}

async function findCsvFiles(dir) {
  const files = await fs.readdir(dir);
  return files
    .filter(f => f.toLowerCase().endsWith('.csv'))
    .map(f => path.join(dir, f));
}

async function parseCsvFile(filePath, rules) {
  return new Promise((resolve, reject) => {
    const records = [];
    const headers = [];
    let firstRow = true;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
        const missing = rules.fields.required.filter(f => !headers.includes(f));
        if (missing.length > 0) {
          reject(new Error(`缺少必需列: ${missing.join(', ')}`));
        }
      })
      .on('data', (data) => {
        records.push(data);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', (error) => {
        reject(new Error(`文件解析失败: ${error.message}`));
      });
  });
}

function analyzeRecords(records, rules) {
  const result = {
    totalRecords: records.length,
    duplicateExtensions: [],
    expiredTenants: [],
    salesDuplicateSubmissions: [],
    convertedTenants: [],
    withdrawnExtensions: [],
    duplicateRows: [],
    validRecords: []
  };

  const tenantMap = new Map();
  const rowHashSet = new Set();

  for (const record of records) {
    const rowHash = hashRecord(record);
    
    if (rowHashSet.has(rowHash)) {
      result.duplicateRows.push(record);
      continue;
    }
    rowHashSet.add(rowHash);

    const tenantId = record[rules.fields.tenantId] || record['租户ID'] || '';
    const salesName = record[rules.fields.salesName] || record['销售姓名'] || '';
    const status = record[rules.fields.status] || record['状态'] || '';
    const extensionDate = record[rules.fields.extensionDate] || record['延期日期'] || '';

    if (!tenantId) {
      continue;
    }

    if (isConvertedStatus(status, rules)) {
      result.convertedTenants.push(record);
      continue;
    }

    if (isWithdrawnStatus(status, rules)) {
      result.withdrawnExtensions.push(record);
      continue;
    }

    if (isExpired(record, rules)) {
      result.expiredTenants.push(record);
    }

    if (tenantMap.has(tenantId)) {
      tenantMap.get(tenantId).push(record);
    } else {
      tenantMap.set(tenantId, [record]);
    }
  }

  for (const [tenantId, tenantRecords] of tenantMap) {
    if (tenantRecords.length > 1) {
      result.duplicateExtensions.push(...tenantRecords);
      
      const salesNames = new Set(tenantRecords.map(r => 
        r[rules.fields.salesName] || r['销售姓名'] || ''
      ).filter(Boolean));
      
      if (salesNames.size > 1) {
        result.salesDuplicateSubmissions.push({
          tenantId,
          tenantName: tenantRecords[0][rules.fields.tenantName] || tenantRecords[0]['租户名称'] || '',
          salesNames: Array.from(salesNames),
          records: tenantRecords
        });
      }
    } else {
      result.validRecords.push(tenantRecords[0]);
    }
  }

  return result;
}

function hashRecord(record) {
  return JSON.stringify(Object.values(record).map(v => String(v).trim()));
}

function isConvertedStatus(status, rules) {
  const convertedStatuses = rules.businessRules.convertedStatuses || ['正式', '已转正', '试用转正'];
  return convertedStatuses.some(s => status.includes(s));
}

function isWithdrawnStatus(status, rules) {
  const withdrawnStatuses = rules.businessRules.withdrawnStatuses || ['撤回', '已撤回', '延期撤回'];
  return withdrawnStatuses.some(s => status.includes(s));
}

function isExpired(record, rules) {
  const expireDateField = rules.fields.expireDate || '到期日期';
  const expireDateStr = record[expireDateField];
  
  if (!expireDateStr) {
    return false;
  }

  try {
    const expireDate = new Date(expireDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expireDate < today;
  } catch {
    return false;
  }
}

function printAnalysisSummary(analysis) {
  console.log(chalk.cyan('='.repeat(50)));
  console.log(chalk.cyan.bold('  试用租户清单延期审批巡检 - 分析结果'));
  console.log(chalk.cyan('='.repeat(50)));
  console.log('');
  
  console.log(chalk.white.bold('【总体统计】'));
  console.log(`  总记录数: ${analysis.totalRecords}`);
  console.log(`  有效记录: ${analysis.validRecords.length}`);
  console.log(`  重复行: ${analysis.duplicateRows.length}`);
  console.log('');

  console.log(chalk.yellow.bold('【重复延期检测】'));
  console.log(`  重复延期记录: ${analysis.duplicateExtensions.length}`);
  console.log('');

  console.log(chalk.red.bold('【过期租户统计】'));
  console.log(`  已过期租户: ${analysis.expiredTenants.length}`);
  console.log('');

  console.log(chalk.magenta.bold('【销售重名提交】'));
  console.log(`  销售重复提交案例: ${analysis.salesDuplicateSubmissions.length}`);
  if (analysis.salesDuplicateSubmissions.length > 0) {
    analysis.salesDuplicateSubmissions.forEach(item => {
      console.log(`    - 租户 ${item.tenantName} (${item.tenantId}): ${item.salesNames.join(', ')}`);
    });
  }
  console.log('');

  console.log(chalk.green.bold('【试用转正租户】'));
  console.log(`  已转正租户: ${analysis.convertedTenants.length}`);
  console.log('');

  console.log(chalk.gray.bold('【延期撤回记录】'));
  console.log(`  延期撤回: ${analysis.withdrawnExtensions.length}`);
  console.log('');
}

async function writeOutputFiles(outputDir, analysis, rules, options) {
  await fs.ensureDir(outputDir);

  const writers = [
    { name: '01_总体统计.csv', type: 'summary' },
    { name: '02_重复延期租户.csv', data: analysis.duplicateExtensions },
    { name: '03_过期租户.csv', data: analysis.expiredTenants },
    { name: '04_销售重复提交.csv', type: 'salesDuplicate' },
    { name: '05_试用转正租户.csv', data: analysis.convertedTenants },
    { name: '06_延期撤回记录.csv', data: analysis.withdrawnExtensions },
    { name: '07_重复行记录.csv', data: analysis.duplicateRows },
    { name: '08_有效记录.csv', data: analysis.validRecords }
  ];

  for (const writer of writers) {
    const filePath = path.join(outputDir, writer.name);
    
    if (writer.type === 'summary') {
      await writeSummaryFile(filePath, analysis);
    } else if (writer.type === 'salesDuplicate') {
      await writeSalesDuplicateFile(filePath, analysis.salesDuplicateSubmissions);
    } else {
      await writeCsvFile(filePath, writer.data);
    }
  }
}

async function writeSummaryFile(filePath, analysis) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'category', title: '分类' },
      { id: 'subCategory', title: '子分类' },
      { id: 'count', title: '数量' },
      { id: 'description', title: '说明' }
    ]
  });

  const records = [
    { category: '总体统计', subCategory: '总记录数', count: analysis.totalRecords, description: '所有文件中的记录总数' },
    { category: '总体统计', subCategory: '有效记录', count: analysis.validRecords.length, description: '去重后无问题的记录数' },
    { category: '总体统计', subCategory: '重复行', count: analysis.duplicateRows.length, description: '完全重复的行' },
    { category: '问题检测', subCategory: '重复延期记录', count: analysis.duplicateExtensions.length, description: '同一租户多次提交延期' },
    { category: '问题检测', subCategory: '已过期租户', count: analysis.expiredTenants.length, description: '试用期已过期的租户' },
    { category: '特殊处理', subCategory: '销售重复提交', count: analysis.salesDuplicateSubmissions.length, description: '不同销售提交同一租户' },
    { category: '特殊处理', subCategory: '试用转正租户', count: analysis.convertedTenants.length, description: '已转为正式客户' },
    { category: '特殊处理', subCategory: '延期撤回记录', count: analysis.withdrawnExtensions.length, description: '已撤回的延期申请' }
  ];

  await csvWriter.writeRecords(records);
}

async function writeSalesDuplicateFile(filePath, data) {
  const records = data.flatMap(item => 
    item.records.map(r => ({
      ...r,
      涉及销售数量: item.salesNames.length,
      涉及销售名单: item.salesNames.join('; ')
    }))
  );

  await writeCsvFile(filePath, records);
}

async function writeCsvFile(filePath, data) {
  if (data.length === 0) {
    await fs.writeFile(filePath, '无数据\n');
    return;
  }

  const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
  const csvWriter = createCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h, title: h }))
  });

  await csvWriter.writeRecords(data);
}

module.exports = {
  runAudit,
  analyzeRecords,
  parseCsvFile
};
