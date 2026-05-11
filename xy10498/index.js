#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const dataStore = require('./src/dataStore');
const businessLogic = require('./src/businessLogic');
const report = require('./src/report');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .name('mm')
  .description('活动物料归还 CLI - 管理活动物料台账、领用、归还、报损等')
  .version('1.0.0');

program
  .command('material:add')
  .description('添加物料到台账')
  .requiredOption('-c, --code <code>', '物料代码')
  .requiredOption('-n, --name <name>', '物料名称')
  .requiredOption('-u, --unit <unit>', '单位')
  .option('-s, --stock <stock>', '初始库存', parseInt)
  .option('-d, --description <description>', '描述')
  .action((options) => {
    try {
      const material = dataStore.addMaterial({
        code: options.code,
        name: options.name,
        unit: options.unit,
        initialStock: options.stock || 0,
        description: options.description
      });
      console.log(chalk.green(`✅ 物料添加成功: ${material.name} (${material.code})`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('material:list')
  .description('查看物料台账')
  .action(() => {
    console.log(report.generateMaterialTable());
  });

program
  .command('activity:add')
  .description('添加活动')
  .requiredOption('-i, --id <id>', '活动ID')
  .requiredOption('-n, --name <name>', '活动名称')
  .requiredOption('-s, --start <start>', '开始日期 (YYYY-MM-DD)')
  .requiredOption('-e, --end <end>', '结束日期 (YYYY-MM-DD)')
  .option('-l, --location <location>', '活动地点')
  .action((options) => {
    try {
      const activity = dataStore.addActivity({
        id: options.id,
        name: options.name,
        startDate: options.start,
        endDate: options.end,
        location: options.location
      });
      console.log(chalk.green(`✅ 活动添加成功: ${activity.name} (${activity.id})`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('activity:list')
  .description('查看活动列表')
  .action(() => {
    console.log(report.generateActivitiesTable());
  });

program
  .command('leader:import')
  .description('导入活动领用物料')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-f, --file <file>', '领用物料 JSON 文件路径')
  .action((options) => {
    try {
      const filePath = path.resolve(options.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      const materials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = dataStore.addLeader(options.activity, materials);
      
      console.log(chalk.green(`✅ 成功导入 ${result.length} 条领用记录`));
      for (const item of result) {
        console.log(`   - ${item.materialName}: ${item.quantity} ${item.unit}`);
      }
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('return:add')
  .description('登记物料归还')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-m, --material <materialCode>', '物料代码')
  .requiredOption('-q, --quantity <quantity>', '归还数量', parseInt)
  .option('-r, --remark <remark>', '备注')
  .action((options) => {
    try {
      const validation = businessLogic.validateReturn(
        options.activity,
        options.material,
        options.quantity
      );
      
      for (const warning of validation.warnings) {
        console.log(chalk.yellow(`⚠️  ${warning}`));
      }
      
      if (!validation.valid) {
        for (const error of validation.errors) {
          console.error(chalk.red(`❌ ${error}`));
        }
        process.exit(1);
      }
      
      const result = dataStore.addReturn({
        activityId: options.activity,
        materialCode: options.material,
        quantity: options.quantity,
        remark: options.remark
      });
      
      console.log(chalk.green(`✅ 归还登记成功: ${result.materialName} ${result.quantity} ${result.unit}`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('loss:add')
  .description('登记物料丢失')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-m, --material <materialCode>', '物料代码')
  .requiredOption('-q, --quantity <quantity>', '丢失数量', parseInt)
  .option('-r, --reason <reason>', '丢失原因', '未说明')
  .option('--remark <remark>', '备注')
  .action((options) => {
    try {
      const result = dataStore.addLoss({
        activityId: options.activity,
        materialCode: options.material,
        quantity: options.quantity,
        reason: options.reason,
        remark: options.remark
      });
      
      console.log(chalk.yellow(`⚠️  丢失登记: ${result.materialName} ${result.quantity} ${result.unit} (原因: ${result.reason})`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('damage:add')
  .description('登记物料报损')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-m, --material <materialCode>', '物料代码')
  .requiredOption('-q, --quantity <quantity>', '报损数量', parseInt)
  .option('-r, --reason <reason>', '报损原因', '未说明')
  .option('--remark <remark>', '备注')
  .action((options) => {
    try {
      const result = dataStore.addDamage({
        activityId: options.activity,
        materialCode: options.material,
        quantity: options.quantity,
        reason: options.reason,
        remark: options.remark
      });
      
      console.log(chalk.magenta(`⚠️  报损登记: ${result.materialName} ${result.quantity} ${result.unit} (原因: ${result.reason})`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('consumption:add')
  .description('登记礼品消耗')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-m, --material <materialCode>', '物料代码')
  .requiredOption('-q, --quantity <quantity>', '消耗数量', parseInt)
  .requiredOption('-d, --description <description>', '消耗说明（去向/原因）')
  .action((options) => {
    try {
      const result = dataStore.addConsumption({
        activityId: options.activity,
        materialCode: options.material,
        quantity: options.quantity,
        description: options.description
      });
      
      console.log(chalk.cyan(`🎁 消耗登记: ${result.materialName} ${result.quantity} ${result.unit}`));
      console.log(`   说明: ${result.description}`);
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('demand:set')
  .description('设置活动物料需求（用于库存预警）')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .requiredOption('-f, --file <file>', '需求物料 JSON 文件路径')
  .action((options) => {
    try {
      const filePath = path.resolve(options.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      const demands = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = dataStore.addActivityDemand(options.activity, demands);
      
      console.log(chalk.green(`✅ 成功设置 ${result.length} 项物料需求`));
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('report:activity')
  .description('生成活动物料报告')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .action((options) => {
    console.log(report.generateActivityReport(options.activity));
  });

program
  .command('report:purchase')
  .description('生成补采购建议')
  .action(() => {
    console.log(report.generatePurchaseReport());
  });

program
  .command('report:inventory')
  .description('生成当前库存报告')
  .action(() => {
    console.log(report.generateInventoryReport());
  });

program
  .command('activity:balance')
  .description('计算活动物料平衡')
  .requiredOption('-a, --activity <activityId>', '活动ID')
  .action((options) => {
    try {
      const balance = businessLogic.calculateActivityBalance(options.activity);
      const issues = businessLogic.checkActivityCompletion(options.activity);
      
      console.log(chalk.blue(`\n活动 ${options.activity} 物料平衡:\n`));
      
      for (const item of balance) {
        const status = item.balance === 0 ? chalk.green('✅ 已平账') :
                      item.balance > 0 ? chalk.yellow(`⚠️  待处理: ${item.balance} ${item.unit}`) :
                      chalk.red(`❌ 异常: 多 ${Math.abs(item.balance)} ${item.unit}`);
        console.log(`  ${item.materialName} (${item.materialCode}):`);
        console.log(`    借出: ${item.borrowed} ${item.unit}`);
        console.log(`    归还: ${item.returned} ${item.unit}`);
        console.log(`    丢失: ${item.lost} ${item.unit}`);
        console.log(`    报损: ${item.damaged} ${item.unit}`);
        console.log(`    消耗: ${item.consumed} ${item.unit}`);
        console.log(`    状态: ${status}`);
        console.log('');
      }
      
      if (issues.length > 0) {
        console.log(chalk.red('\n存在问题:'));
        for (const issue of issues) {
          console.log(`  - ${issue.message}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
