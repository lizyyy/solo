#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const program = new Command();

program
  .name('问诊处方目录处方撤回对账')
  .description('问诊处方目录处方撤回对账 CLI - 核对处方撤回是否通知到位')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '输入文件路径（CSV格式的处方数据）')
  .requiredOption('-r, --rules <path>', '规则文件路径（JSON格式）')
  .requiredOption('-o, --output <dir>', '输出目录路径')
  .option('--dry-run', '试运行模式，不生成实际输出文件', false)
  .option('--overwrite', '覆盖已存在的输出文件', false)
  .option('-v, --verbose', '详细模式，显示每条记录的处理过程', false)
  .action(async (options) => {
    await runReconciliation(options);
  });

program.parse();

async function runReconciliation(options) {
  const logger = createLogger(options.verbose);
  
  logger.logHeader('问诊处方目录处方撤回对账');
  logger.logInfo(`开始时间: ${new Date().toLocaleString()}`);
  logger.logInfo(`输入文件: ${options.input}`);
  logger.logInfo(`规则文件: ${options.rules}`);
  logger.logInfo(`输出目录: ${options.output}`);
  logger.logInfo(`试运行模式: ${options.dryRun ? '是' : '否'}`);
  logger.logInfo('');

  try {
    validateInput(options, logger);
    const rules = loadRules(options.rules, logger);
    const prescriptions = await loadPrescriptions(options.input, logger);
    const results = processPrescriptions(prescriptions, rules, logger);
    
    if (!options.dryRun) {
      await writeResults(results, options.output, options.overwrite, logger);
    } else {
      logger.logInfo('【试运行模式】跳过文件写入');
    }
    
    logger.logSummary(results);
    logger.logInfo(`结束时间: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    logger.logError(error.message);
    process.exit(1);
  }
}

function createLogger(verbose) {
  return {
    verbose,
    
    logHeader(text) {
      console.log('='.repeat(60));
      console.log(`  ${text}`);
      console.log('='.repeat(60));
    },
    
    logInfo(text) {
      console.log(text);
    },
    
    logDetail(text) {
      if (this.verbose) {
        console.log(`  ${text}`);
      }
    },
    
    logWarning(text) {
      console.log(`⚠️  ${text}`);
    },
    
    logError(text) {
      console.error(`❌ 错误: ${text}`);
    },
    
    logRecordDetail(record, status, reason) {
      if (this.verbose) {
        const prefix = status === '异常' ? '🔴' : status === '需关注' ? '🟡' : '🟢';
        console.log(`  ${prefix} 处方号: ${record.处方号}`);
        console.log(`     患者: ${record.患者姓名} | 医生: ${record.开具医生}`);
        console.log(`     状态: ${status}`);
        if (reason) console.log(`     说明: ${reason}`);
        console.log('');
      }
    },
    
    logSummary(results) {
      console.log('\n' + '='.repeat(60));
      console.log('  对账摘要');
      console.log('='.repeat(60));
      console.log(`总处方数: ${results.total}`);
      console.log(`正常撤回: ${results.normal}`);
      console.log(`异常撤回: ${results.abnormal}`);
      console.log(`需关注记录:`);
      console.log(`  - 药房已配: ${results.pharmacyDispensed.length}`);
      console.log(`  - 患者已取: ${results.patientReceived.length}`);
      console.log(`  - 医生改方: ${results.doctorModified.length}`);
      console.log(`未通知到位: ${results.notNotified.length}`);
    }
  };
}

function validateInput(options, logger) {
  if (!fs.existsSync(options.input)) {
    throw new Error(`输入文件不存在: ${options.input}`);
  }
  if (!fs.existsSync(options.rules)) {
    throw new Error(`规则文件不存在: ${options.rules}`);
  }
  if (!options.dryRun) {
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
      logger.logInfo(`创建输出目录: ${options.output}`);
    }
  }
}

function loadRules(rulesPath, logger) {
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  logger.logInfo(`已加载规则: ${rules.name || '未命名规则'}`);
  logger.logDetail(`规则版本: ${rules.version || '未指定'}`);
  return rules;
}

async function loadPrescriptions(inputPath, logger) {
  const prescriptions = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => prescriptions.push(data))
      .on('end', () => {
        logger.logInfo(`已加载处方记录: ${prescriptions.length} 条`);
        resolve(prescriptions);
      })
      .on('error', reject);
  });
}

function processPrescriptions(prescriptions, rules, logger) {
  const results = {
    total: prescriptions.length,
    normal: 0,
    abnormal: 0,
    pharmacyDispensed: [],
    patientReceived: [],
    doctorModified: [],
    notNotified: [],
    allRecords: []
  };

  logger.logInfo('开始处理处方记录...');
  logger.logInfo('');

  for (const record of prescriptions) {
    const processed = processSingleRecord(record, rules, logger);
    results.allRecords.push(processed);
    
    if (processed.status === '正常撤回') {
      results.normal++;
    } else {
      results.abnormal++;
    }
    
    if (processed.isPharmacyDispensed) {
      results.pharmacyDispensed.push(processed);
    }
    if (processed.isPatientReceived) {
      results.patientReceived.push(processed);
    }
    if (processed.isDoctorModified) {
      results.doctorModified.push(processed);
    }
    if (processed.isNotNotified) {
      results.notNotified.push(processed);
    }
  }

  return results;
}

function processSingleRecord(record, rules, logger) {
  const processed = {
    ...record,
    status: '正常撤回',
    statusReason: '',
    isPharmacyDispensed: false,
    isPatientReceived: false,
    isDoctorModified: false,
    isNotNotified: false,
    processingNotes: []
  };

  const dispenseStatus = record[rules.fields.dispenseStatus] || '';
  const pickupStatus = record[rules.fields.pickupStatus] || '';
  const modifiedFlag = record[rules.fields.modifiedFlag] || '';
  const notificationStatus = record[rules.fields.notificationStatus] || '';

  if (rules.pharmacyDispensedValues.includes(dispenseStatus)) {
    processed.isPharmacyDispensed = true;
    processed.status = '需关注';
    processed.statusReason = '药房已配药，撤回需特别确认';
    processed.processingNotes.push('【药房已配】');
  }

  if (rules.patientReceivedValues.includes(pickupStatus)) {
    processed.isPatientReceived = true;
    processed.status = '异常';
    processed.statusReason = '患者已取药，无法撤回';
    processed.processingNotes.push('【患者已取】');
  }

  if (rules.doctorModifiedValues.includes(modifiedFlag)) {
    processed.isDoctorModified = true;
    processed.status = '需关注';
    processed.statusReason = processed.statusReason || '医生已改方';
    processed.processingNotes.push('【医生改方】');
  }

  if (!rules.notificationSuccessValues.includes(notificationStatus)) {
    processed.isNotNotified = true;
    if (processed.status === '正常撤回') {
      processed.status = '异常';
    }
    processed.statusReason = processed.statusReason || '撤回未通知到位';
    processed.processingNotes.push('【未通知】');
  }

  logger.logRecordDetail(record, processed.status, processed.statusReason);
  return processed;
}

async function writeResults(results, outputDir, overwrite, logger) {
  const timestamp = new Date().toISOString().slice(0, 10);
  
  const writers = [
    {
      filename: `处方撤回对账_全部记录_${timestamp}.csv`,
      data: results.allRecords,
      title: '全部记录'
    },
    {
      filename: `处方撤回对账_药房已配_${timestamp}.csv`,
      data: results.pharmacyDispensed,
      title: '药房已配'
    },
    {
      filename: `处方撤回对账_患者已取_${timestamp}.csv`,
      data: results.patientReceived,
      title: '患者已取'
    },
    {
      filename: `处方撤回对账_医生改方_${timestamp}.csv`,
      data: results.doctorModified,
      title: '医生改方'
    },
    {
      filename: `处方撤回对账_未通知到位_${timestamp}.csv`,
      data: results.notNotified,
      title: '未通知到位'
    }
  ];

  for (const writer of writers) {
    const outputPath = path.join(outputDir, writer.filename);
    
    if (fs.existsSync(outputPath) && !overwrite) {
      logger.logWarning(`文件已存在，跳过: ${outputPath}`);
      continue;
    }

    if (writer.data.length === 0) {
      logger.logDetail(`无${writer.title}数据，跳过生成`);
      continue;
    }

    const headers = Object.keys(writer.data[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: headers
    });

    await csvWriter.writeRecords(writer.data);
    logger.logInfo(`已生成: ${outputPath} (${writer.data.length}条)`);
  }

  const summaryPath = path.join(outputDir, `处方撤回对账_摘要_${timestamp}.json`);
  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.total,
    normal: results.normal,
    abnormal: results.abnormal,
    pharmacyDispensed: results.pharmacyDispensed.length,
    patientReceived: results.patientReceived.length,
    doctorModified: results.doctorModified.length,
    notNotified: results.notNotified.length,
    statistics: {
      normalRate: ((results.normal / results.total) * 100).toFixed(2) + '%',
      abnormalRate: ((results.abnormal / results.total) * 100).toFixed(2) + '%'
    }
  };
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  logger.logInfo(`已生成摘要: ${summaryPath}`);
}
