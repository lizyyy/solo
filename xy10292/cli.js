#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');

const storeService = require('./src/services/storeService');
const cleaningService = require('./src/services/cleaningRecordService');
const intensityService = require('./src/services/businessIntensityService');
const inspectionService = require('./src/services/fireInspectionService');
const scheduleService = require('./src/services/scheduleService');
const reportService = require('./src/services/reportService');

const program = new Command();

program
  .name('kitchen-clean')
  .description('商用厨房油烟管道清洗排期管理工具')
  .version('1.0.0');

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

program
  .command('import <type> <file>')
  .description('导入数据 (stores|cleaning|intensity|inspection)')
  .option('-o, --operator <name>', '操作人姓名', 'system')
  .action((type, file, options) => {
    try {
      const data = readJsonFile(file);
      let result;
      
      switch (type.toLowerCase()) {
        case 'stores':
        case 'store':
          result = storeService.importStores(data, options.operator);
          console.log(chalk.green(`\n✅ 门店档案导入完成:`));
          break;
        case 'cleaning':
        case 'cleaning-records':
          result = cleaningService.importCleaningRecords(data, options.operator);
          console.log(chalk.green(`\n✅ 清洗记录导入完成:`));
          break;
        case 'intensity':
        case 'business-intensity':
          result = intensityService.importBusinessIntensity(data, options.operator);
          console.log(chalk.green(`\n✅ 营业强度导入完成:`));
          break;
        case 'inspection':
        case 'fire-inspection':
          result = inspectionService.importFireInspections(data, options.operator);
          console.log(chalk.green(`\n✅ 消防检查导入完成:`));
          break;
        default:
          console.log(chalk.red(`❌ 未知数据类型: ${type}`));
          console.log(chalk.yellow('   支持的类型: stores, cleaning, intensity, inspection'));
          process.exit(1);
      }
      
      console.log(`   新增: ${result.added} 条`);
      console.log(`   更新: ${result.updated} 条`);
      console.log(`   删除: ${result.deleted} 条`);
    } catch (e) {
      console.log(chalk.red(`❌ 导入失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('运行清洗排期检查')
  .option('-d, --date <date>', '检查日期 (YYYY-MM-DD)')
  .option('-v, --verbose', '显示详细信息')
  .action((options) => {
    const asOfDate = options.date ? new Date(options.date) : new Date();
    console.log(chalk.blue(`\n🔍 运行清洗排期检查...`));
    console.log(chalk.blue(`   检查日期: ${asOfDate.toLocaleDateString('zh-CN')}`));
    
    const result = scheduleService.runCheck(asOfDate);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(chalk.bold('📊 检查结果汇总:'));
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   门店总数: ${result.totalStores}`);
    console.log(`   ${chalk.green('✅ 清洗正常:')} ${result.summary.normal}`);
    console.log(`   ${chalk.yellow('🟡 即将到期:')} ${result.summary.warning}`);
    console.log(`   ${chalk.red('🔴 清洗逾期:')} ${result.summary.overdue}`);
    console.log(`   ${chalk.red('🔥 消防检查逾期:')} ${result.summary.inspectionOverdue}`);
    
    if (result.anomalies.length > 0) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(chalk.red('⚠️  异常门店详情:'));
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      for (const anomaly of result.anomalies) {
        console.log(`\n${chalk.bold(`【${anomaly.storeId}】${anomaly.storeName}`)}`);
        if (anomaly.location) console.log(`   地址: ${anomaly.location}`);
        if (anomaly.manager) console.log(`   负责人: ${anomaly.manager}`);
        if (anomaly.phone) console.log(`   电话: ${anomaly.phone}`);
        console.log(`   下次清洗: ${anomaly.nextCleanDate}`);
        
        for (const item of anomaly.anomalies) {
          const color = item.severity === 'critical' ? chalk.red : chalk.yellow;
          console.log(`   ${color(`• ${item.message}`)}`);
          if (options.verbose && item.details) {
            console.log(`     详情: ${JSON.stringify(item.details)}`);
          }
        }
      }
    } else {
      console.log(`\n${chalk.green('✅ 所有门店状态正常，无异常。')}`);
    }
    
    console.log(`\n💡 使用 'kitchen-clean export' 生成完整报告`);
  });

program
  .command('query [storeId]')
  .description('查询异常或特定门店状态')
  .option('-a, --all', '显示所有门店')
  .option('-o, --overdue', '只显示逾期门店')
  .option('-w, --warning', '只显示警告门店')
  .action((storeId, options) => {
    const result = scheduleService.getLatestCheckResult();
    
    if (!result) {
      console.log(chalk.yellow('⚠️  没有找到检查记录，请先运行 kitchen-clean check'));
      return;
    }
    
    let schedules = result.schedules;
    
    if (storeId) {
      schedules = schedules.filter(s => s.storeId === storeId);
      if (schedules.length === 0) {
        console.log(chalk.red(`❌ 未找到门店: ${storeId}`));
        return;
      }
    }
    
    if (options.overdue) {
      schedules = schedules.filter(s => s.isOverdue);
    } else if (options.warning) {
      schedules = schedules.filter(s => s.isWarning);
    } else if (!options.all && !storeId) {
      schedules = schedules.filter(s => s.isOverdue || s.isWarning);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(chalk.bold('📋 门店状态查询结果:'));
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    if (schedules.length === 0) {
      console.log(chalk.green('\n   没有符合条件的门店'));
      return;
    }
    
    for (const schedule of schedules) {
      let status = chalk.green('✅ 正常');
      if (schedule.isOverdue) status = chalk.red('🔴 逾期');
      else if (schedule.isWarning) status = chalk.yellow('🟡 即将到期');
      
      console.log(`\n${chalk.bold(`【${schedule.storeId}】${schedule.storeName}`)}`);
      console.log(`   状态: ${status}`);
      console.log(`   上次清洗: ${schedule.lastCleanDate}`);
      console.log(`   下次清洗: ${schedule.nextCleanDate}`);
      console.log(`   剩余天数: ${schedule.daysRemaining} 天`);
      console.log(`   清洗周期: 基础 ${schedule.cycleInfo.baseCycle} 天 → 调整后 ${schedule.cycleInfo.finalCycleDays} 天`);
      console.log(`   营业强度: ${schedule.cycleInfo.intensityLevel} (系数 ${schedule.cycleInfo.intensityMultiplier})`);
      if (schedule.cycleInfo.notes.length > 0) {
        console.log(`   备注: ${schedule.cycleInfo.notes.join(', ')}`);
      }
    }
  });

program
  .command('export')
  .description('导出报告给业务负责人')
  .option('-f, --format <format>', '格式: txt|json', 'txt')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    const result = scheduleService.getLatestCheckResult();
    
    if (!result) {
      console.log(chalk.yellow('⚠️  没有找到检查记录，请先运行 kitchen-clean check'));
      return;
    }
    
    let filePath;
    if (options.format.toLowerCase() === 'json') {
      filePath = reportService.exportJson(result, options.output);
    } else {
      filePath = reportService.exportManagerReport(result, options.output);
    }
    
    console.log(chalk.green(`\n✅ 报告已导出:`));
    console.log(`   ${filePath}`);
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-t, --type <type>', '按实体类型过滤: STORE|CLEANING_RECORD|BUSINESS_INTENSITY|FIRE_INSPECTION')
  .option('-i, --id <id>', '按实体ID过滤')
  .option('-o, --operation <op>', '按操作类型过滤: CREATE|UPDATE|DELETE')
  .option('-n, --limit <n>', '显示条数', '20')
  .action((options) => {
    const history = reportService.listHistory({
      entityType: options.type,
      entityId: options.id,
      operation: options.operation
    });
    
    const limit = parseInt(options.limit) || 20;
    const displayHistory = history.slice(0, limit);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(chalk.bold('📜 操作历史记录:'));
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   共 ${history.length} 条记录，显示前 ${displayHistory.length} 条\n`);
    
    for (const record of displayHistory) {
      const opColor = record.operation === 'DELETE' ? chalk.red : 
                      record.operation === 'UPDATE' ? chalk.yellow : chalk.green;
      
      console.log(`${chalk.gray(record.timestamp.split('T')[0])} ${chalk.gray(record.timestamp.split('T')[1].slice(0, 8))}`);
      console.log(`  ${opColor(record.operation.padEnd(8))} ${chalk.blue(record.entityType.padEnd(20))} ${record.entityId}`);
      console.log(`  操作人: ${record.operator}`);
      
      if (record.operation === 'CREATE') {
        console.log(`  新增内容: ${JSON.stringify(record.after).substring(0, 200)}`);
      } else if (record.operation === 'UPDATE') {
        console.log(`  变更前: ${JSON.stringify(record.before).substring(0, 150)}`);
        console.log(`  变更后: ${JSON.stringify(record.after).substring(0, 150)}`);
      } else if (record.operation === 'DELETE') {
        console.log(`  删除内容: ${JSON.stringify(record.before).substring(0, 200)}`);
      }
      console.log();
    }
  });

program
  .command('demo')
  .description('运行最短演示路径')
  .action(() => {
    console.log(chalk.blue.bold('\n🚀 开始演示最短路径...'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    const demoDataPath = path.join(__dirname, 'demo-data');
    
    console.log(`\n📦 步骤 1: 导入基础数据`);
    
    const stores = readJsonFile(path.join(demoDataPath, 'stores.json'));
    const cleaning = readJsonFile(path.join(demoDataPath, 'cleaning-records.json'));
    const intensity = readJsonFile(path.join(demoDataPath, 'business-intensity.json'));
    const inspections = readJsonFile(path.join(demoDataPath, 'fire-inspections.json'));
    
    storeService.importStores(stores, 'demo');
    cleaningService.importCleaningRecords(cleaning, 'demo');
    intensityService.importBusinessIntensity(intensity, 'demo');
    inspectionService.importFireInspections(inspections, 'demo');
    
    console.log(chalk.green('   ✅ 所有数据已导入'));
    
    console.log(`\n🔍 步骤 2: 运行清洗排期检查`);
    const checkDate = new Date('2026-05-10');
    const result = scheduleService.runCheck(checkDate);
    
    console.log(`   门店总数: ${result.totalStores}`);
    console.log(`   清洗正常: ${result.summary.normal}`);
    console.log(`   即将到期: ${result.summary.warning}`);
    console.log(`   清洗逾期: ${result.summary.overdue}`);
    console.log(`   消防检查逾期: ${result.summary.inspectionOverdue}`);
    
    console.log(`\n📊 步骤 3: 查询异常门店`);
    if (result.anomalies.length > 0) {
      for (const anomaly of result.anomalies) {
        console.log(`   ${chalk.red('•')} ${anomaly.storeName}: ${anomaly.anomalies[0].message}`);
      }
    }
    
    console.log(`\n📄 步骤 4: 导出报告`);
    const reportPath = reportService.exportManagerReport(result);
    console.log(chalk.green(`   ✅ 报告已生成: ${reportPath}`));
    
    console.log(`\n${chalk.blue.bold('🎉 演示完成！')}`);
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('\n💡 接下来可以尝试:'));
    console.log('   kitchen-clean history --limit 10  查看操作历史');
    console.log('   kitchen-clean query --overdue      只看逾期门店');
    console.log('   kitchen-clean check --date 2026-06-01  模拟未来日期检查');
  });

program
  .command('demo-anomaly')
  .description('运行异常触发路径演示')
  .action(() => {
    console.log(chalk.red.bold('\n⚠️  开始异常路径演示...'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    const demoDataPath = path.join(__dirname, 'demo-data');
    
    console.log(`\n📦 导入异常门店数据（包含多种问题）`);
    
    const badStores = readJsonFile(path.join(demoDataPath, 'anomaly-stores.json'));
    const badCleaning = readJsonFile(path.join(demoDataPath, 'anomaly-cleaning.json'));
    const badIntensity = readJsonFile(path.join(demoDataPath, 'anomaly-intensity.json'));
    const badInspections = readJsonFile(path.join(demoDataPath, 'anomaly-inspections.json'));
    
    storeService.importStores(badStores, 'demo-anomaly');
    cleaningService.importCleaningRecords(badCleaning, 'demo-anomaly');
    intensityService.importBusinessIntensity(badIntensity, 'demo-anomaly');
    inspectionService.importFireInspections(badInspections, 'demo-anomaly');
    
    console.log(chalk.green('   ✅ 异常数据已导入'));
    
    console.log(`\n🔍 运行检查（模拟 2026-08-01，故意让问题暴露）`);
    const checkDate = new Date('2026-08-01');
    const result = scheduleService.runCheck(checkDate);
    
    console.log(`\n${chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    console.log(chalk.red.bold('🚨 触发的异常列表:'));
    console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    for (const anomaly of result.anomalies) {
      console.log(`\n${chalk.bold(`【${anomaly.storeId}】${anomaly.storeName}`)}`);
      for (const item of anomaly.anomalies) {
        const severity = item.severity === 'critical' ? chalk.red('🔴 严重') : chalk.yellow('🟡 警告');
        console.log(`   ${severity}: ${item.message}`);
      }
    }
    
    console.log(`\n${chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    console.log(chalk.yellow.bold('📋 各门店问题分析:'));
    console.log(chalk.yellow.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(`
  1. 川味王火锅店:
     • 营业强度 extreme（系数 0.5），周期从 90 天缩短至 45 天
     • 消防检查不合格，周期再缩短 40% 至 27 天
     • 上次清洗 2026-06-01，应该 2026-06-28 清洗
     • 到 2026-08-01 已逾期 34 天
     • 消防检查也已逾期

  2. 老张烧烤店:
     • 营业强度 high（系数 0.7），周期缩短至 63 天
     • 上次清洗 2026-05-15，应该 2026-07-17 清洗
     • 到 2026-08-01 已逾期 15 天

  3. 星星快餐店:
     • 无清洗历史记录，无法准确计算
     • 需要确认开业日期或补录首次清洗记录

  4. 江南酒家:
     • 消防检查条件通过，周期缩短 20%
     • 清洗即将到期，剩余 5 天，需要提前安排
`);
    
    console.log(chalk.red.bold('⚠️  异常路径演示完成！这些场景都是实际业务中需要关注的问题。'));
  });

program.parse(process.argv);