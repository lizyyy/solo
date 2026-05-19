const yargs = require('yargs');
const chalk = require('chalk');
const path = require('path');

const { initDatabase } = require('./models/init');
const importService = require('./services/importService');
const statusService = require('./services/statusService');
const reviewService = require('./services/reviewService');
const exportService = require('./services/exportService');
const hazardModel = require('./models/hazard');
const importBatchModel = require('./models/importBatch');

async function init() {
  await initDatabase();
}

function printImportResult(result) {
  console.log('\n' + chalk.bold.blue('=== 导入结果 ==='));
  console.log(`批次ID: ${result.batchId}`);
  console.log(`状态: ${result.status}`);
  console.log(chalk.green(`成功: ${result.success}`));
  console.log(chalk.red(`失败: ${result.failed}`));
  console.log(chalk.yellow(`跳过: ${result.skipped}`));
}

async function importHazardsCommand(argv) {
  await init();
  console.log(chalk.blue(`开始导入隐患数据: ${argv.file}`));
  
  const result = await importService.importHazardsFromCSV(argv.file, argv.operator);
  printImportResult(result);
  
  if (result.failed > 0) {
    console.log(chalk.yellow(`\n使用以下命令查看失败记录并重试:`));
    console.log(`  node src/cli.js import-errors --batch ${result.batchId}`);
    console.log(`  node src/cli.js retry --batch ${result.batchId}`);
  }
}

async function importPhotosCommand(argv) {
  await init();
  console.log(chalk.blue(`开始导入照片索引: ${argv.file}`));
  
  const result = await importService.importPhotosFromJSON(argv.file, argv.operator);
  printImportResult(result);
}

async function importReviewsCommand(argv) {
  await init();
  console.log(chalk.blue(`开始导入复查记录: ${argv.file}`));
  
  const result = await importService.importReviewsFromCSV(argv.file, argv.operator);
  printImportResult(result);
}

async function importErrorsCommand(argv) {
  await init();
  const failedRecords = await importService.getFailedRecords(argv.batch);
  
  console.log('\n' + chalk.bold.red(`=== 失败记录 (共 ${failedRecords.length} 条) ===`));
  console.log('\n');
  
  failedRecords.forEach((record, index) => {
    const raw = JSON.parse(record.raw_data);
    console.log(chalk.bold(`\n[${index + 1}] 行号: ${record.row_number}`));
    console.log(`原始数据: ${JSON.stringify(raw)}`);
    console.log(chalk.red(`错误信息: ${record.error_message}`));
    console.log(chalk.yellow(`修改建议: ${record.suggestion}`));
  });
}

async function retryCommand(argv) {
  await init();
  console.log(chalk.blue(`重试导入批次: ${argv.batch}`));
  
  const result = await importService.retryBatch(argv.batch, argv.operator);
  printImportResult(result);
}

async function listBatchesCommand(argv) {
  await init();
  const batches = await importBatchModel.listBatches(argv.limit);
  
  console.log('\n' + chalk.bold.blue('=== 导入批次列表 ==='));
  batches.forEach(b => {
    const statusColor = b.status === 'success' ? chalk.green : 
                        b.status === 'partial' ? chalk.yellow : 
                        b.status === 'failed' ? chalk.red : chalk.gray;
    console.log(
      `${b.batch_id.substring(0, 8)}... | ${statusColor(b.status.padEnd(10))} | ` +
      `${b.import_type.padEnd(8)} | 成功:${String(b.success_count).padStart(3)} | ` +
      `失败:${String(b.failed_count).padStart(3)} | ${b.file_name}`
    );
  });
}

async function assignCommand(argv) {
  await init();
  const hazardCodes = argv.codes.split(',');
  const deadline = argv.deadline ? new Date(argv.deadline) : null;
  
  console.log(chalk.blue(`批量分配责任人: ${hazardCodes.length} 条隐患`));
  
  const result = await statusService.batchAssign(
    hazardCodes, 
    argv.person, 
    deadline, 
    argv.operator
  );
  
  console.log(chalk.green(`成功: ${result.successCount}`));
  console.log(chalk.red(`失败: ${result.failedCount}`));
  
  if (result.failed.length > 0) {
    result.failed.forEach(f => {
      console.log(chalk.red(`  ${f.hazardCode}: ${f.error}`));
    });
  }
}

async function reviewCommand(argv) {
  await init();
  
  if (argv.codes) {
    const hazardCodes = argv.codes.split(',');
    console.log(chalk.blue(`批量复查: ${hazardCodes.length} 条隐患`));
    
    const result = await statusService.batchReview(
      hazardCodes,
      argv.result,
      argv.reviewer,
      argv.comments
    );
    
    console.log(chalk.green(`成功: ${result.successCount}`));
    console.log(chalk.red(`失败: ${result.failedCount}`));
    
    if (result.failed.length > 0) {
      result.failed.forEach(f => {
        console.log(chalk.red(`  ${f.hazardCode}: ${f.error}`));
      });
    }
  } else {
    console.log(chalk.blue(`开始数据复核...`));
    const result = await reviewService.reviewAllHazards();
    
    console.log('\n' + chalk.bold.blue('=== 复核结果 ==='));
    console.log(`总数: ${result.stats.total}`);
    console.log(chalk.red(`有错误: ${result.stats.withErrors}`));
    console.log(chalk.yellow(`有警告: ${result.stats.withWarnings}`));
    console.log(chalk.green(`可闭环: ${result.stats.canClose}`));
    
    result.results.forEach(r => {
      if (r.issueCount && (r.issueCount.error > 0 || r.issueCount.warning > 0)) {
        console.log(`\n${chalk.bold(r.hazardCode)}: ${r.hazard.title}`);
        r.issues.forEach(issue => {
          const color = issue.type === 'error' ? chalk.red : 
                        issue.type === 'warning' ? chalk.yellow : chalk.gray;
          console.log(`  ${color(`[${issue.type}]`)} ${issue.message}`);
        });
      }
    });
  }
}

async function statusCommand(argv) {
  await init();
  
  if (argv.code) {
    const details = await reviewService.getHazardDetails(argv.code);
    
    console.log('\n' + chalk.bold.blue(`=== 隐患详情: ${argv.code} ===`));
    console.log(`标题: ${details.hazard.title}`);
    console.log(`状态: ${details.statusLabel}`);
    console.log(`位置: ${details.hazard.location}`);
    console.log(`责任人: ${details.hazard.responsible_person || '未分配'}`);
    console.log(`整改期限: ${details.hazard.deadline || '未设置'}`);
    
    if (details.photos.length > 0) {
      console.log(`\n照片 (${details.photos.length} 张):`);
      details.photos.forEach(p => {
        console.log(`  - [${p.photo_type}] ${p.file_path}`);
      });
    }
    
    if (details.history.length > 0) {
      console.log(`\n状态变更历史:`);
      details.history.forEach(h => {
        console.log(`  ${h.created_at}: ${h.from_status || '新建'} -> ${h.to_status} (${h.operator})`);
      });
    }
  } else {
    const stats = await hazardModel.getStatistics();
    
    console.log('\n' + chalk.bold.blue('=== 系统统计 ==='));
    console.log(`隐患总数: ${stats.total}`);
    console.log(chalk.green(`已闭环: ${stats.closed}`));
    console.log(chalk.yellow(`待处理: ${stats.pending}`));
    console.log(chalk.red(`超期待处理: ${stats.overdue}`));
    console.log(chalk.bold(`闭环率: ${stats.closureRate}%`));
    
    console.log('\n按状态统计:');
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      const label = require('./utils/constants').HAZARD_STATUS_LABELS[status] || status;
      console.log(`  ${label}: ${count}`);
    });
    
    console.log('\n按级别统计:');
    Object.entries(stats.byLevel).forEach(([level, count]) => {
      const label = require('./utils/constants').HAZARD_LEVEL_LABELS[level] || level;
      console.log(`  ${label}: ${count}`);
    });
  }
}

async function exportCommand(argv) {
  await init();
  
  const outputDir = argv.output || path.join(__dirname, '../data/exports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  if (argv.type === 'hazards') {
    const outputPath = path.join(outputDir, `隐患清单_${timestamp}.xlsx`);
    const result = await exportService.exportHazardsToExcel(outputPath);
    console.log(chalk.green(`导出成功: ${result.filePath} (${result.recordCount} 条记录)`));
  } else if (argv.type === 'photos') {
    const outputPath = path.join(outputDir, `照片清单_${timestamp}.xlsx`);
    const result = await exportService.exportPhotosReport(outputPath);
    console.log(chalk.green(`导出成功: ${result.filePath} (${result.recordCount} 条记录)`));
  } else if (argv.type === 'closure') {
    const outputPath = path.join(outputDir, `闭环统计_${timestamp}.xlsx`);
    const result = await exportService.exportClosureStatus(outputPath);
    console.log(chalk.green(`导出成功: ${result.filePath}`));
    console.log(`  总数: ${result.total}, 已闭环: ${result.closed}, 闭环率: ${result.closureRate}%`);
  } else if (argv.type === 'errors' && argv.batch) {
    const outputPath = path.join(outputDir, `导入错误_${argv.batch.substring(0, 8)}.xlsx`);
    const result = await exportService.exportImportErrorsToExcel(argv.batch, outputPath);
    console.log(chalk.green(`导出成功: ${result.filePath} (${result.errorCount} 条错误记录)`));
  } else if (argv.type === 'monthly') {
    const year = argv.year || new Date().getFullYear();
    const month = argv.month || new Date().getMonth() + 1;
    const result = await exportService.generateMonthlyReport(year, month, outputDir);
    console.log(chalk.green(`生成月度报告成功: ${result.reportPath}`));
  }
}

async function testSampleCommand(argv) {
  await init();
  console.log(chalk.bold.blue('=== 运行完整样例流程 ===\n'));
  
  const sampleDir = path.join(__dirname, '../data/samples');
  
  try {
    console.log(chalk.blue('步骤1: 导入隐患数据'));
    const hazardResult = await importService.importHazardsFromCSV(
      path.join(sampleDir, 'hazards.csv'), 
      'test-operator'
    );
    printImportResult(hazardResult);
    
    console.log('\n' + chalk.blue('步骤2: 导入照片数据'));
    const photoResult = await importService.importPhotosFromJSON(
      path.join(sampleDir, 'photos.json'), 
      'test-operator'
    );
    printImportResult(photoResult);
    
    console.log('\n' + chalk.blue('步骤3: 导入异常数据测试'));
    try {
      const errorResult = await importService.importHazardsFromCSV(
        path.join(sampleDir, 'hazards_with_errors.csv'), 
        'test-operator'
      );
      printImportResult(errorResult);
    } catch (e) {
      console.log(chalk.yellow(`异常数据测试完成: ${e.message}`));
    }
    
    console.log('\n' + chalk.blue('步骤4: 执行数据复核'));
    const reviewResult = await reviewService.reviewAllHazards();
    console.log(`复核完成 - 总数:${reviewResult.stats.total}, 有错误:${reviewResult.stats.withErrors}`);
    
    console.log('\n' + chalk.blue('步骤5: 执行状态变更'));
    const hazards = await hazardModel.findAll({ status: 'new' });
    if (hazards.length > 0) {
      const code = hazards[0].hazard_code;
      console.log(`  分配责任人: ${code}`);
      await statusService.assign(code, '张三', new Date('2024-12-31'), 'test-operator');
      
      console.log(`  开始整改: ${code}`);
      await statusService.startRectification(code, '已完成现场整改', 'test-operator');
      
      console.log(`  申请复查: ${code}`);
      await statusService.completeRectification(code, 'test-operator');
      
      console.log(`  复查通过: ${code}`);
      await statusService.review(code, 'pass', '李四', '整改合格，同意闭环');
    }
    
    console.log('\n' + chalk.blue('步骤6: 导出闭环报告'));
    const exportDir = path.join(__dirname, '../data/exports');
    const exportResult = await exportService.exportClosureStatus(
      path.join(exportDir, '样例测试_闭环报告.xlsx')
    );
    console.log(`  导出完成: ${exportResult.filePath}`);
    
    console.log('\n' + chalk.bold.green('=== 样例流程完成! ==='));
    console.log(`闭环率: ${exportResult.closureRate}%`);
    
  } catch (e) {
    console.error(chalk.red('样例运行失败:'), e);
    throw e;
  }
}

yargs
  .command({
    command: 'import-hazards',
    describe: '导入隐患数据CSV',
    builder: {
      file: { type: 'string', demandOption: true, alias: 'f', describe: 'CSV文件路径' },
      operator: { type: 'string', default: 'system', alias: 'o', describe: '操作人' }
    },
    handler: importHazardsCommand
  })
  .command({
    command: 'import-photos',
    describe: '导入照片索引JSON',
    builder: {
      file: { type: 'string', demandOption: true, alias: 'f', describe: 'JSON文件路径' },
      operator: { type: 'string', default: 'system', alias: 'o', describe: '操作人' }
    },
    handler: importPhotosCommand
  })
  .command({
    command: 'import-reviews',
    describe: '导入复查记录CSV',
    builder: {
      file: { type: 'string', demandOption: true, alias: 'f', describe: 'CSV文件路径' },
      operator: { type: 'string', default: 'system', alias: 'o', describe: '操作人' }
    },
    handler: importReviewsCommand
  })
  .command({
    command: 'import-errors',
    describe: '查看导入失败记录',
    builder: {
      batch: { type: 'string', demandOption: true, alias: 'b', describe: '批次ID' }
    },
    handler: importErrorsCommand
  })
  .command({
    command: 'retry',
    describe: '重试导入失败记录',
    builder: {
      batch: { type: 'string', demandOption: true, alias: 'b', describe: '批次ID' },
      operator: { type: 'string', default: 'system', alias: 'o', describe: '操作人' }
    },
    handler: retryCommand
  })
  .command({
    command: 'list-batches',
    describe: '列出导入批次',
    builder: {
      limit: { type: 'number', default: 20, alias: 'l', describe: '显示数量' }
    },
    handler: listBatchesCommand
  })
  .command({
    command: 'assign',
    describe: '批量分配整改责任人',
    builder: {
      codes: { type: 'string', demandOption: true, describe: '隐患编号，逗号分隔' },
      person: { type: 'string', demandOption: true, alias: 'p', describe: '责任人' },
      deadline: { type: 'string', alias: 'd', describe: '整改期限 YYYY-MM-DD' },
      operator: { type: 'string', default: 'system', alias: 'o', describe: '操作人' }
    },
    handler: assignCommand
  })
  .command({
    command: 'review',
    describe: '复核数据或批量复查',
    builder: {
      codes: { type: 'string', describe: '隐患编号，逗号分隔' },
      result: { type: 'string', choices: ['pass', 'fail'], describe: '复查结果' },
      reviewer: { type: 'string', alias: 'r', describe: '复查人' },
      comments: { type: 'string', default: '', alias: 'c', describe: '复查意见' }
    },
    handler: reviewCommand
  })
  .command({
    command: 'status',
    describe: '查看统计或单条隐患状态',
    builder: {
      code: { type: 'string', alias: 'c', describe: '隐患编号' }
    },
    handler: statusCommand
  })
  .command({
    command: 'export',
    describe: '导出数据',
    builder: {
      type: { 
        type: 'string', 
        demandOption: true, 
        choices: ['hazards', 'photos', 'closure', 'errors', 'monthly'],
        alias: 't',
        describe: '导出类型' 
      },
      batch: { type: 'string', alias: 'b', describe: '批次ID (errors类型时需要)' },
      output: { type: 'string', alias: 'o', describe: '输出目录' },
      year: { type: 'number', alias: 'y', describe: '年份 (monthly类型)' },
      month: { type: 'number', alias: 'm', describe: '月份 (monthly类型)' }
    },
    handler: exportCommand
  })
  .command({
    command: 'test-sample',
    describe: '运行完整样例流程',
    handler: testSampleCommand
  })
  .help()
  .alias('help', 'h')
  .epilogue('隐患闭环管理系统 - 帮助安全员月底轻松说明隐患闭环情况')
  .argv;
