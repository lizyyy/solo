#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const program = new Command();

const PROCESS_LOG_FILE = '.refund-process-log.json';
const REQUIRED_COLUMNS = [
  '订单编号', '班次编号', '乘客姓名', '身份证号', '联系电话',
  '发车时间', '终点站', '票价', '票种', '购票时间',
  '是否改签', '退款申请时间', '处理状态'
];

const OPTIONAL_COLUMNS = ['原订单编号'];

function loadProcessLog() {
  if (fs.existsSync(PROCESS_LOG_FILE)) {
    return JSON.parse(fs.readFileSync(PROCESS_LOG_FILE, 'utf8'));
  }
  return { processedFiles: [], failedFiles: [], records: [] };
}

function saveProcessLog(log) {
  fs.writeFileSync(PROCESS_LOG_FILE, JSON.stringify(log, null, 2));
}

function validateRow(row, rowNumber) {
  const errors = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!row[col] || row[col].trim() === '') {
      errors.push(`缺少列: ${col}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function calculateRefund(row) {
  const ticketPrice = parseFloat(row['票价']) || 0;
  const ticketType = row['票种'];
  const isRescheduled = row['是否改签'] === '是';
  
  let refundRate = 1.0;
  let refundAmount = ticketPrice;
  let remarks = [];
  
  if (ticketType === '儿童票') {
    refundRate = 1.0;
    remarks.push('儿童票全额退款');
  } else {
    const purchaseTime = new Date(row['购票时间']);
    const refundApplyTime = new Date(row['退款申请时间']);
    const hoursDiff = (refundApplyTime - purchaseTime) / (1000 * 60 * 60);
    
    if (hoursDiff < 2) {
      refundRate = 0.9;
      remarks.push('2小时内退票扣10%手续费');
    } else if (hoursDiff < 24) {
      refundRate = 0.95;
      remarks.push('24小时内退票扣5%手续费');
    } else {
      refundRate = 1.0;
      remarks.push('全额退款');
    }
  }
  
  if (isRescheduled) {
    refundRate = Math.max(refundRate - 0.05, 0.8);
    remarks.push('改签后退票额外扣5%，最低80%');
    refundAmount = ticketPrice * refundRate;
  } else {
    refundAmount = ticketPrice * refundRate;
  }
  
  return {
    refundAmount: refundAmount.toFixed(2),
    refundRate: (refundRate * 100).toFixed(0) + '%',
    remarks: remarks.join('; ')
  };
}

function sortRecords(records) {
  return records.sort((a, b) => {
    if (a['班次编号'] !== b['班次编号']) {
      return a['班次编号'].localeCompare(b['班次编号']);
    }
    return a['订单编号'].localeCompare(b['订单编号']);
  });
}

async function processFile(filePath, processLog, continueMode) {
  const results = [];
  const errors = [];
  const seenOrders = new Set();
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        const allColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
        const missingCols = allColumns.filter(col => !headers.includes(col));
        if (missingCols.length > 0) {
          errors.push(`文件缺少必要列: ${missingCols.join(', ')}`);
        }
      })
      .on('data', (data) => {
        const rowNum = results.length + 1;
        const orderId = data['订单编号'];
        
        if (continueMode && processLog.records.some(r => r['订单编号'] === orderId)) {
          return;
        }
        
        if (seenOrders.has(orderId)) {
          errors.push(`第${rowNum}行: 重复订单 ${orderId}`);
          return;
        }
        seenOrders.add(orderId);
        
        const validation = validateRow(data, rowNum);
        if (!validation.valid) {
          errors.push(`第${rowNum}行: ${validation.errors.join(', ')}`);
          return;
        }
        
        const refundInfo = calculateRefund(data);
        results.push({
          ...data,
          '退款金额': refundInfo.refundAmount,
          '退款比例': refundInfo.refundRate,
          '备注': refundInfo.remarks,
          '处理时间': new Date().toISOString(),
          '处理状态': '已处理'
        });
      })
      .on('end', () => {
        resolve({ success: errors.length === 0, results, errors, filePath });
      })
      .on('error', (error) => {
        reject({ filePath, error: error.message });
      });
  });
}

async function processFiles(inputFiles, outputFile, continueMode) {
  const processLog = loadProcessLog();
  let allResults = continueMode ? [...processLog.records] : [];
  let allErrors = [];
  
  for (const filePath of inputFiles) {
    if (continueMode && processLog.processedFiles.includes(filePath)) {
      console.log(`跳过已处理文件: ${filePath}`);
      continue;
    }
    
    if (!fs.existsSync(filePath)) {
      const error = `文件不存在: ${filePath}`;
      allErrors.push(error);
      processLog.failedFiles.push({ filePath, error, timestamp: new Date().toISOString() });
      continue;
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      const error = `空文件: ${filePath}`;
      allErrors.push(error);
      processLog.failedFiles.push({ filePath, error, timestamp: new Date().toISOString() });
      continue;
    }
    
    try {
      console.log(`处理文件: ${filePath}`);
      const result = await processFile(filePath, processLog, continueMode);
      
      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
        processLog.failedFiles.push({ 
          filePath, 
          errors: result.errors, 
          timestamp: new Date().toISOString() 
        });
      }
      
      allResults.push(...result.results);
      processLog.processedFiles.push(filePath);
      console.log(`  成功处理 ${result.results.length} 条记录`);
      
    } catch (e) {
      allErrors.push(`处理文件失败 ${filePath}: ${e.error}`);
      processLog.failedFiles.push({ 
        filePath, 
        error: e.error, 
        timestamp: new Date().toISOString() 
      });
    }
  }
  
  const sortedResults = sortRecords(allResults);
  processLog.records = sortedResults;
  saveProcessLog(processLog);
  
  if (sortedResults.length > 0) {
    const csvWriter = createCsvWriter({
      path: outputFile,
      header: Object.keys(sortedResults[0]).map(key => ({ id: key, title: key }))
    });
    await csvWriter.writeRecords(sortedResults);
    console.log(`\n结果已写入: ${outputFile}`);
    console.log(`总计处理: ${sortedResults.length} 条记录`);
  }
  
  if (allErrors.length > 0) {
    console.log('\n错误信息:');
    allErrors.forEach(err => console.log(`  - ${err}`));
  }
  
  return { results: sortedResults, errors: allErrors };
}

program
  .name('bus-refund')
  .description('乡镇客运站客运班次退款处理CLI工具')
  .version('1.0.0');

program
  .command('process')
  .description('处理退款文件')
  .argument('<files...>', '输入CSV文件路径')
  .option('-o, --output <file>', '输出文件路径', 'refund-results.csv')
  .option('-c, --continue', '断点续跑模式')
  .option('-r, --reset', '重置处理日志')
  .action(async (files, options) => {
    if (options.reset) {
      if (fs.existsSync(PROCESS_LOG_FILE)) {
        fs.unlinkSync(PROCESS_LOG_FILE);
        console.log('已重置处理日志');
      }
    }
    
    await processFiles(files, options.output, options.continue);
  });

program
  .command('status')
  .description('查看处理状态')
  .action(() => {
    const log = loadProcessLog();
    console.log('=== 处理状态 ===');
    console.log(`已处理文件数: ${log.processedFiles.length}`);
    console.log(`失败文件数: ${log.failedFiles.length}`);
    console.log(`已处理记录数: ${log.records.length}`);
    
    if (log.failedFiles.length > 0) {
      console.log('\n失败文件:');
      log.failedFiles.forEach(f => {
        console.log(`  - ${f.filePath}: ${f.error || f.errors?.join(', ')}`);
      });
    }
  });

program
  .command('example')
  .description('生成示例输入文件')
  .option('-o, --output <file>', '输出文件路径', 'example-input.csv')
  .action(async (options) => {
    const exampleData = [
      {
        '订单编号': 'DD202405010001',
        '班次编号': 'BC-XZ-001',
        '乘客姓名': '张三',
        '身份证号': '440101199001011234',
        '联系电话': '13800138001',
        '发车时间': '2024-05-02 08:30:00',
        '终点站': '县城汽车站',
        '票价': '25.00',
        '票种': '成人票',
        '购票时间': '2024-05-01 10:00:00',
        '是否改签': '否',
        '原订单编号': '',
        '退款申请时间': '2024-05-01 14:00:00',
        '处理状态': '待处理'
      },
      {
        '订单编号': 'DD202405010002',
        '班次编号': 'BC-XZ-001',
        '乘客姓名': '张小宝',
        '身份证号': '440101201501011234',
        '联系电话': '13800138001',
        '发车时间': '2024-05-02 08:30:00',
        '终点站': '县城汽车站',
        '票价': '12.50',
        '票种': '儿童票',
        '购票时间': '2024-05-01 10:00:00',
        '是否改签': '否',
        '原订单编号': '',
        '退款申请时间': '2024-05-01 14:00:00',
        '处理状态': '待处理'
      },
      {
        '订单编号': 'DD202405010003',
        '班次编号': 'BC-XZ-002',
        '乘客姓名': '李四',
        '身份证号': '440101198505055678',
        '联系电话': '13900139002',
        '发车时间': '2024-05-03 14:00:00',
        '终点站': '邻镇客运站',
        '票价': '18.00',
        '票种': '成人票',
        '购票时间': '2024-05-01 09:00:00',
        '是否改签': '是',
        '原订单编号': 'DD202404280005',
        '退款申请时间': '2024-05-01 10:30:00',
        '处理状态': '待处理'
      }
    ];
    
    const csvWriter = createCsvWriter({
      path: options.output,
      header: Object.keys(exampleData[0]).map(key => ({ id: key, title: key }))
    });
    await csvWriter.writeRecords(exampleData);
    console.log(`示例文件已生成: ${options.output}`);
  });

program.parse(process.argv);