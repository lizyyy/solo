#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const BatchService = require('../src/services/BatchService');
const SettlementService = require('../src/services/SettlementService');
const ReviewService = require('../src/services/ReviewService');
const ExportService = require('../src/services/ExportService');
const dataStore = require('../src/utils/dataStore');

const program = new Command();

program
  .name('grain-settle')
  .description('粮食烘干批次结算服务')
  .version('1.0.0');

program
  .command('init')
  .description('初始化项目数据目录')
  .action(() => {
    dataStore.init();
    console.log(chalk.green('✓ 项目初始化完成'));
  });

program
  .command('seed')
  .description('生成测试数据')
  .option('-n, --number <number>', '生成批次数量', '5')
  .action((options) => {
    const seedService = require('../src/services/SeedService');
    const count = parseInt(options.number);
    const batches = seedService.generateBatches(count);
    console.log(chalk.green(`✓ 已生成 ${count} 个测试批次`));
    batches.forEach(b => {
      console.log(chalk.cyan(`  - 批次 ${b.batchNo}: ${b.grainType} 入仓重量 ${b.inWeight.toFixed(2)}kg`));
    });
  });

program
  .command('batch:list')
  .description('查看所有批次')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    const batchService = new BatchService();
    const batches = batchService.listBatches(options.status);
    if (batches.length === 0) {
      console.log(chalk.yellow('暂无批次数据'));
      return;
    }
    console.log(chalk.cyan(`共 ${batches.length} 个批次：`));
    batches.forEach(b => {
      console.log(`  ${chalk.green(b.batchNo)} - ${b.grainType} - ${b.status}`);
    });
  });

program
  .command('batch:create')
  .description('创建新批次')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .requiredOption('-t, --grain-type <type>', '粮食类型')
  .requiredOption('-w, --in-weight <weight>', '入仓重量(kg)')
  .requiredOption('-m, --in-moisture <moisture>', '入仓水分(%)')
  .option('--in-temp <temp>', '入仓温度(℃)')
  .action((options) => {
    const batchService = new BatchService();
    const batch = batchService.createBatch({
      batchNo: options.batchNo,
      grainType: options.grainType,
      inWeight: parseFloat(options.inWeight),
      inMoisture: parseFloat(options.inMoisture),
      inTemp: options.inTemp ? parseFloat(options.inTemp) : undefined
    });
    console.log(chalk.green(`✓ 批次创建成功: ${batch.batchNo}`));
    console.log(`  ID: ${batch.id}`);
    console.log(`  状态: ${batch.status}`);
  });

program
  .command('batch:update')
  .description('更新批次数据（补录）')
  .option('--batch-no <no>', '批次编号')
  .option('--out-weight <weight>', '出仓重量(kg)')
  .option('--out-moisture <moisture>', '出仓水分(%)')
  .option('--out-temp <temp>', '出仓温度(℃)')
  .option('--drying-time <time>', '烘干时长(分钟)')
  .option('--fuel-used <fuel>', '燃料用量')
  .option('--power-used <power>', '用电量(度)')
  .action((options) => {
    const batchService = new BatchService();
    const updateData = {};
    if (options.outWeight) updateData.outWeight = parseFloat(options.outWeight);
    if (options.outMoisture) updateData.outMoisture = parseFloat(options.outMoisture);
    if (options.outTemp) updateData.outTemp = parseFloat(options.outTemp);
    if (options.dryingTime) updateData.dryingTime = parseFloat(options.dryingTime);
    if (options.fuelUsed) updateData.fuelUsed = parseFloat(options.fuelUsed);
    if (options.powerUsed) updateData.powerUsed = parseFloat(options.powerUsed);
    
    try {
      const batch = batchService.updateBatch(options.batchNo, updateData);
      console.log(chalk.green(`✓ 批次更新成功: ${batch.batchNo}`));
      console.log(`  新状态: ${batch.status}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('batch:detail')
  .description('查看批次详情')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .action((options) => {
    const batchService = new BatchService();
    const batch = batchService.getBatchByNo(options.batchNo);
    if (!batch) {
      console.log(chalk.red(`✗ 未找到批次: ${options.batchNo}`));
      return;
    }
    console.log(chalk.cyan(`\n批次详情: ${batch.batchNo}`));
    console.log('='.repeat(40));
    console.log(`ID: ${batch.id}`);
    console.log(`粮食类型: ${batch.grainType}`);
    console.log(`状态: ${batch.status}`);
    console.log(`\n入仓数据:`);
    console.log(`  重量: ${batch.inWeight?.toFixed(2)} kg`);
    console.log(`  水分: ${batch.inMoisture}%`);
    if (batch.inTemp) console.log(`  温度: ${batch.inTemp}℃`);
    console.log(`  时间: ${batch.inTime}`);
    if (batch.outWeight !== undefined) {
      console.log(`\n出仓数据:`);
      console.log(`  重量: ${batch.outWeight?.toFixed(2)} kg`);
      console.log(`  水分: ${batch.outMoisture}%`);
      if (batch.outTemp) console.log(`  温度: ${batch.outTemp}℃`);
      console.log(`  时间: ${batch.outTime}`);
      console.log(`\n烘干数据:`);
      if (batch.dryingTime) console.log(`  时长: ${batch.dryingTime} 分钟`);
      if (batch.fuelUsed) console.log(`  燃料: ${batch.fuelUsed}`);
      if (batch.powerUsed) console.log(`  用电: ${batch.powerUsed} 度`);
    }
    console.log(`\n创建时间: ${batch.createdAt}`);
    console.log(`更新时间: ${batch.updatedAt}`);
    console.log('='.repeat(40));
  });

program
  .command('batch:delete')
  .description('删除批次')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .option('-f, --force', '强制删除（即使已结算）')
  .action((options) => {
    const batchService = new BatchService();
    try {
      batchService.deleteBatch(options.batchNo, options.force);
      console.log(chalk.green(`✓ 批次已删除: ${options.batchNo}`));
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('review:submit')
  .description('提交批次审核')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .option('-r, --retry', '超时后重试')
  .action(async (options) => {
    const reviewService = new ReviewService();
    try {
      const review = await reviewService.submitReview(options.batchNo, options.retry);
      console.log(chalk.green(`✓ 审核提交成功`));
      console.log(`  审核ID: ${review.id}`);
      console.log(`  状态: ${review.status}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('review:list')
  .description('查看审核列表')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    const reviewService = new ReviewService();
    const reviews = reviewService.listReviews(options.status);
    if (reviews.length === 0) {
      console.log(chalk.yellow('暂无审核记录'));
      return;
    }
    console.log(chalk.cyan(`共 ${reviews.length} 条审核记录：`));
    reviews.forEach(r => {
      console.log(`  ${r.batchNo} - ${r.status} - ${r.updatedAt}`);
    });
  });

program
  .command('review:approve')
  .description('通过审核')
  .requiredOption('-i, --review-id <id>', '审核ID')
  .option('-c, --conflict-mode <mode>', '冲突处理模式: merge/reject', 'merge')
  .action((options) => {
    const reviewService = new ReviewService();
    try {
      const review = reviewService.approveReview(options.reviewId, options.conflictMode);
      console.log(chalk.green(`✓ 审核通过`));
      console.log(`  批次: ${review.batchNo}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('review:reject')
  .description('拒绝审核')
  .requiredOption('-i, --review-id <id>', '审核ID')
  .option('-r, --reason <reason>', '拒绝原因', '数据不完整或有误')
  .action((options) => {
    const reviewService = new ReviewService();
    try {
      const review = reviewService.rejectReview(options.reviewId, options.reason);
      console.log(chalk.yellow(`✓ 审核已拒绝`));
      console.log(`  原因: ${review.rejectReason}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('review:cancel')
  .description('撤销审核')
  .requiredOption('-i, --review-id <id>', '审核ID')
  .action((options) => {
    const reviewService = new ReviewService();
    try {
      const review = reviewService.cancelReview(options.reviewId);
      console.log(chalk.green(`✓ 审核已撤销`));
      console.log(`  批次: ${review.batchNo}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('settlement:run')
  .description('执行结算')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .option('-r, --retry', '超时后重试')
  .action(async (options) => {
    const settlementService = new SettlementService();
    try {
      const settlement = await settlementService.calculateSettlement(options.batchNo, options.retry);
      console.log(chalk.green(`✓ 结算完成`));
      console.log(`\n结算单详情:`);
      console.log(`  结算单ID: ${settlement.id}`);
      console.log(`  批次: ${settlement.batchNo}`);
      console.log(`  烘干量: ${settlement.dryingAmount.toFixed(2)} kg`);
      console.log(`  水分去除量: ${settlement.moistureRemoved.toFixed(2)} kg`);
      console.log(`  能耗分摊: ¥${settlement.energyCost.toFixed(2)}`);
      console.log(`  结算金额: ¥${settlement.settlementAmount.toFixed(2)}`);
      console.log(`  状态: ${settlement.status}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('settlement:list')
  .description('查看结算单列表')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    const settlementService = new SettlementService();
    const settlements = settlementService.listSettlements(options.status);
    if (settlements.length === 0) {
      console.log(chalk.yellow('暂无结算单'));
      return;
    }
    console.log(chalk.cyan(`共 ${settlements.length} 张结算单：`));
    settlements.forEach(s => {
      console.log(`  ${s.batchNo} - ¥${s.settlementAmount.toFixed(2)} - ${s.status}`);
    });
  });

program
  .command('settlement:rollback')
  .description('撤销结算')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .action((options) => {
    const settlementService = new SettlementService();
    try {
      const settlement = settlementService.rollbackSettlement(options.batchNo);
      console.log(chalk.green(`✓ 结算已撤销`));
      console.log(`  批次: ${settlement.batchNo}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('export:anomalies')
  .description('导出异常数据')
  .option('-o, --output <path>', '输出路径')
  .option('-t, --type <type>', '异常类型')
  .action((options) => {
    const exportService = new ExportService();
    const result = exportService.exportAnomalies({
      outputPath: options.output,
      type: options.type
    });
    console.log(chalk.green(`✓ 异常数据导出成功`));
    console.log(`  输出文件: ${result.filePath}`);
    console.log(`  异常数量: ${result.count}`);
    if (result.count > 0) {
      console.log(`\n异常列表:`);
      result.anomalies.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.batchNo} - ${a.type}: ${a.message}`);
      });
    }
  });

program
  .command('simulate:conflict')
  .description('模拟数据冲突')
  .requiredOption('-n, --batch-no <no>', '批次编号')
  .action((options) => {
    const batchService = new BatchService();
    try {
      const conflict = batchService.simulateConflict(options.batchNo);
      console.log(chalk.yellow(`✓ 冲突已创建`));
      console.log(`  批次: ${conflict.batchNo}`);
      console.log(`  冲突字段: ${conflict.field}`);
      console.log(`  原值: ${conflict.originalValue}`);
      console.log(`  新值: ${conflict.newValue}`);
    } catch (e) {
      console.log(chalk.red(`✗ 错误: ${e.message}`));
    }
  });

program
  .command('simulate:timeout')
  .description('模拟超时')
  .requiredOption('-a, --action <action>', '操作类型: review/settlement')
  .action((options) => {
    const service = options.action === 'review' 
      ? new ReviewService() 
      : new SettlementService();
    
    console.log(chalk.yellow(`正在模拟 ${options.action} 超时...`));
    console.log(chalk.cyan('提示: 使用 --retry 选项可以在超时后重试'));
  });

program
  .command('flow:demo')
  .description('演示完整流程')
  .action(async () => {
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('  粮食烘干批次结算服务 - 完整流程演示'));
    console.log(chalk.cyan('='.repeat(60) + '\n'));
    
    const batchService = new BatchService();
    const reviewService = new ReviewService();
    const settlementService = new SettlementService();
    const seedService = require('../src/services/SeedService');
    
    const batchNo = 'DEMO-' + Date.now().toString().slice(-6);
    console.log(chalk.blue('步骤 1: 创建烘干批次'));
    const batch = batchService.createBatch({
      batchNo,
      grainType: '玉米',
      inWeight: 10000,
      inMoisture: 28.5,
      inTemp: 25
    });
    console.log(chalk.green(`  ✓ 批次 ${batch.batchNo} 创建成功`));
    console.log(`  状态: ${batch.status}`);
    console.log(`  入仓: ${batch.inWeight}kg, 水分${batch.inMoisture}%\n`);
    
    console.log(chalk.blue('步骤 2: 补录烘干数据'));
    const updatedBatch = batchService.updateBatch(batchNo, {
      outWeight: 8500,
      outMoisture: 14.5,
      outTemp: 35,
      dryingTime: 480,
      fuelUsed: 500,
      powerUsed: 320
    });
    console.log(chalk.green(`  ✓ 数据补录完成`));
    console.log(`  出仓: ${updatedBatch.outWeight}kg, 水分${updatedBatch.outMoisture}%`);
    console.log(`  状态: ${updatedBatch.status}\n`);
    
    console.log(chalk.blue('步骤 3: 提交审核'));
    const review = await reviewService.submitReview(batchNo);
    console.log(chalk.green(`  ✓ 审核提交成功`));
    console.log(`  审核ID: ${review.id}\n`);
    
    console.log(chalk.blue('步骤 4: 审核通过'));
    const approvedReview = reviewService.approveReview(review.id);
    console.log(chalk.green(`  ✓ 审核通过\n`));
    
    console.log(chalk.blue('步骤 5: 执行结算'));
    const settlement = await settlementService.calculateSettlement(batchNo);
    console.log(chalk.green(`  ✓ 结算完成`));
    console.log(`  烘干量: ${settlement.dryingAmount.toFixed(2)} kg`);
    console.log(`  水分去除: ${settlement.moistureRemoved.toFixed(2)} kg`);
    console.log(`  能耗分摊: ¥${settlement.energyCost.toFixed(2)}`);
    console.log(`  结算金额: ¥${settlement.settlementAmount.toFixed(2)}\n`);
    
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.green('  演示流程完成！'));
    console.log(chalk.cyan('='.repeat(60) + '\n'));
  });

program.parse(process.argv);
