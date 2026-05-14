#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import { BatchProcessor } from './batch-processor';
import { ResultStore } from './result-store';
import { LogisticsInterception } from './types';
import { v4 as uuidv4 } from 'uuid';

const program = new Command();
const resultStore = new ResultStore();
const batchProcessor = new BatchProcessor(resultStore);

program
  .name('jsdiff')
  .description('JSON Schema 差异比较命令行工具 - 灰度物流拦截专用')
  .version('1.0.0');

program
  .command('preview')
  .description('预览批量处理影响范围')
  .option('-f, --file <path>', '输入 JSON 文件路径')
  .action(async (options) => {
    let items: LogisticsInterception[];
    
    if (options.file) {
      items = await fs.readJson(options.file);
    } else {
      items = generateSampleData();
      console.log(chalk.yellow('使用示例数据进行预览...'));
    }

    const result = batchProcessor.preview(items);
    
    console.log('\n' + chalk.blue('='.repeat(60)));
    console.log(chalk.blue.bold('批量处理预览结果'));
    console.log(chalk.blue('='.repeat(60)));
    console.log(`批次 ID: ${chalk.cyan(result.batchId)}`);
    console.log(`提交时间: ${result.submittedAt}`);
    console.log(`\n总计: ${chalk.white.bold(result.totalCount)} 条`);
    console.log(`预计成功: ${chalk.green.bold(result.successCount)} 条`);
    console.log(`预计失败: ${chalk.red.bold(result.failedCount)} 条`);
    
    console.log('\n' + chalk.yellow('失败分组:'));
    const failureGroups = [...new Set(result.items
      .filter(i => i.failureGroup)
      .map(i => i.failureGroup))];
    
    for (const group of failureGroups) {
      const count = result.items.filter(i => i.failureGroup === group).length;
      console.log(`  ${chalk.red(group)}: ${count} 条`);
    }

    console.log('\n' + chalk.magenta('影响的湖仓分区:'));
    const partitions = [...new Set(result.items.map(i => i.lakehousePartition))];
    for (const partition of partitions) {
      console.log(`  ${partition}`);
    }

    console.log('\n' + chalk.gray('详情: '));
    for (const item of result.items.slice(0, 5)) {
      const statusColor = item.failureReason ? chalk.red : chalk.green;
      console.log(`  订单 ${item.orderId}: ${statusColor(item.failureReason || 'OK')}`);
    }
    if (result.items.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${result.items.length - 5} 条`));
    }
    console.log();
  });

program
  .command('execute')
  .description('执行批量处理')
  .option('-f, --file <path>', '输入 JSON 文件路径')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .option('--skip-preview', '跳过预览直接执行')
  .action(async (options) => {
    let items: LogisticsInterception[];
    
    if (options.file) {
      items = await fs.readJson(options.file);
    } else {
      items = generateSampleData();
      console.log(chalk.yellow('使用示例数据进行处理...'));
    }

    if (!options.skipPreview) {
      const preview = batchProcessor.preview(items);
      console.log('\n' + chalk.blue('预览结果:'));
      console.log(`总计: ${preview.totalCount}, 预计成功: ${chalk.green(preview.successCount)}, 预计失败: ${chalk.red(preview.failedCount)}`);
      
      const answers = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: '确认执行批量处理?',
        default: false
      }]);
      
      if (!answers.confirm) {
        console.log(chalk.yellow('已取消执行'));
        return;
      }
    }

    const result = batchProcessor.execute(items, options.operator);
    
    console.log('\n' + chalk.green('='.repeat(60)));
    console.log(chalk.green.bold('批量处理执行结果'));
    console.log(chalk.green('='.repeat(60)));
    console.log(`批次 ID: ${chalk.cyan(result.batchId)}`);
    console.log(`操作员: ${options.operator}`);
    console.log(`\n总计: ${chalk.white.bold(result.totalCount)} 条`);
    console.log(`成功: ${chalk.green.bold(result.successCount)} 条`);
    console.log(`失败: ${chalk.red.bold(result.failedCount)} 条`);
    console.log(`跳过(复用旧结果): ${chalk.yellow.bold(result.skippedCount)} 条`);
    
    const failedItems = result.items.filter(i => i.status === 'failed');
    if (failedItems.length > 0) {
      console.log('\n' + chalk.red('失败项:'));
      for (const item of failedItems) {
        console.log(`  订单 ${item.orderId}: ${item.failureReason}`);
        if (item.conflict) {
          console.log(`    ${chalk.yellow('冲突: ' + item.conflictReason)}`);
        }
      }
    }
    console.log();
  });

program
  .command('failures')
  .description('查看失败项')
  .option('-g, --group <name>', '按失败分组过滤')
  .option('--list-groups', '列出所有失败分组')
  .action((options) => {
    if (options.listGroups) {
      const groups = resultStore.getFailureGroups();
      console.log('\n' + chalk.blue('失败分组列表:'));
      for (const group of groups) {
        const count = resultStore.getFailuresByGroup(group).length;
        console.log(`  ${chalk.red(group)}: ${count} 条`);
      }
      console.log();
      return;
    }

    let failures = resultStore.loadFailures();
    
    if (options.group) {
      failures = failures.filter(f => f.failureGroup === options.group);
      console.log(`\n${chalk.blue(`分组 "${options.group}" 的失败项:`)}`);
    } else {
      console.log('\n' + chalk.blue('所有失败项:'));
    }

    if (failures.length === 0) {
      console.log(chalk.green('  暂无失败项'));
    } else {
      for (const failure of failures) {
        console.log(`\n  订单: ${chalk.cyan(failure.orderId)}`);
        console.log(`  运单: ${failure.waybillNo}`);
        console.log(`  失败原因: ${chalk.red(failure.failureReason)}`);
        console.log(`  失败分组: ${failure.failureGroup}`);
        if (failure.humanRemarks) {
          console.log(`  ${chalk.yellow('人工备注:')}`);
          console.log(`    ${failure.humanRemarks.replace(/\n/g, '\n    ')}`);
        }
      }
    }
    console.log();
  });

program
  .command('remark')
  .description('添加人工备注')
  .option('-i, --id <resultId>', '结果 ID')
  .option('-r, --remark <text>', '备注内容')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .action(async (options) => {
    if (!options.id) {
      const failures = resultStore.loadFailures();
      if (failures.length === 0) {
        console.log(chalk.yellow('暂无失败项可添加备注'));
        return;
      }
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'id',
          message: '选择要添加备注的失败项:',
          choices: failures.map(f => ({
            name: `${f.orderId} - ${f.failureReason}`,
            value: f.id
          }))
        },
        {
          type: 'input',
          name: 'remark',
          message: '输入备注内容:'
        }
      ]);
      
      options.id = answers.id;
      options.remark = answers.remark;
    }

    const result = resultStore.addHumanRemark(options.id, options.remark, options.operator);
    if (result) {
      console.log(chalk.green('备注添加成功!'));
      console.log(`订单: ${result.orderId}`);
      console.log(`备注内容:\n${chalk.yellow(result.humanRemarks)}`);
    } else {
      console.log(chalk.red('未找到对应的结果记录'));
    }
    console.log();
  });

program
  .command('partitions')
  .description('管理湖仓分区')
  .option('--list', '列出所有分区')
  .option('--unconfirmed', '仅显示未确认的分区')
  .option('--confirm <name>', '确认指定分区')
  .option('-o, --operator <name>', '操作员名称', 'system')
  .action(async (options) => {
    if (options.confirm) {
      const result = resultStore.confirmPartition(options.confirm, options.operator);
      if (result) {
        console.log(chalk.green(`分区 ${result.name} 已确认!`));
      } else {
        console.log(chalk.red('未找到该分区'));
      }
      return;
    }

    let partitions = resultStore.getPartitions();
    
    if (options.unconfirmed) {
      partitions = partitions.filter(p => !p.humanConfirmed);
      console.log(`\n${chalk.blue('未确认的湖仓分区:')}`);
    } else {
      console.log(`\n${chalk.blue('湖仓分区列表:')}`);
    }

    if (partitions.length === 0) {
      console.log(chalk.green('  暂无分区记录'));
    } else {
      for (const p of partitions) {
        const status = p.humanConfirmed 
          ? chalk.green('已确认') 
          : chalk.red('未确认');
        console.log(`  ${p.name} (${status})`);
        console.log(`    日期: ${p.date}, 区域: ${p.region}, 记录数: ${p.recordCount}`);
        if (p.confirmedBy) {
          console.log(`    确认人: ${p.confirmedBy}, 确认时间: ${p.confirmedAt}`);
        }
      }
    }
    console.log();
  });

program
  .command('generate-sample')
  .description('生成示例数据文件')
  .option('-o, --output <path>', '输出文件路径', './sample-data.json')
  .action(async (options) => {
    const data = generateSampleData();
    await fs.writeJson(options.output, data, { spaces: 2 });
    console.log(chalk.green(`示例数据已生成: ${options.output}`));
    console.log(`包含 ${data.length} 条物流拦截记录`);
    console.log();
  });

function generateSampleData(): LogisticsInterception[] {
  const now = new Date().toISOString();
  return [
    {
      id: uuidv4(),
      orderId: 'ORD001',
      waybillNo: 'SF1234567890',
      status: 'intercepted',
      interceptionTime: now,
      reason: '灰度发布拦截',
      grayRelease: true,
      compensationActions: [
        { id: uuidv4(), name: '退款', description: '全额退款', required: true, executed: true, executedAt: now },
        { id: uuidv4(), name: '优惠券', description: '发放10元优惠券', required: true, executed: true, executedAt: now }
      ]
    },
    {
      id: uuidv4(),
      orderId: 'ORD002',
      waybillNo: 'SF1234567891',
      status: 'intercepted',
      interceptionTime: now,
      reason: '灰度发布拦截',
      grayRelease: true,
      compensationActions: [
        { id: uuidv4(), name: '退款', description: '全额退款', required: true, executed: true, executedAt: now },
        { id: uuidv4(), name: '优惠券', description: '发放10元优惠券', required: true, executed: false }
      ]
    },
    {
      id: uuidv4(),
      orderId: 'ORD003',
      waybillNo: 'SF1234567892',
      status: 'intercepted',
      reason: '灰度发布拦截',
      grayRelease: true,
      compensationActions: [
        { id: uuidv4(), name: '退款', description: '全额退款', required: true, executed: true, executedAt: now }
      ]
    },
    {
      id: uuidv4(),
      orderId: 'ORD004',
      waybillNo: 'SF1234567893',
      status: 'failed',
      reason: '灰度发布失败',
      grayRelease: true,
      compensationActions: []
    },
    {
      id: uuidv4(),
      orderId: 'ORD005',
      waybillNo: 'SF1234567894',
      status: 'intercepted',
      interceptionTime: now,
      reason: '灰度发布拦截',
      grayRelease: false,
      compensationActions: [
        { id: uuidv4(), name: '退款', description: '全额退款', required: true, executed: true, executedAt: now },
        { id: uuidv4(), name: '优惠券', description: '发放10元优惠券', required: true, executed: true, executedAt: now }
      ]
    }
  ];
}

program.parse(process.argv);
