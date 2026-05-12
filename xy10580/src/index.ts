#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import path from 'path';
import fs from 'fs';

import { getAppealDir, getDataDir } from './utils/config';
import { initDatabase, isDatabaseInitialized, closeDb } from './db/database';
import { getAllSampleData } from './data/sampleData';
import {
  importOrders, importTrajectories, importMerchantMeals,
  importWeatherEvents, importPenalties, importAppeals
} from './services/importService';
import { checkAppeal, checkPendingAppeals, correctAppeal } from './services/checkService';
import {
  getAppealDetail, listAppeals, getSummaryStats,
  generateReport, exportReportToFile
} from './services/reportService';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('appeal')
  .description('外卖骑手申诉 CLI 工具 - 处理超时、差评、取消单申诉')
  .version('1.0.0');

program
  .command('init')
  .description('初始化申诉系统数据库和目录结构')
  .option('--sample-data', '导入内置样例数据')
  .action(async (options) => {
    logger.header('初始化申诉系统');
    
    const appealDir = getAppealDir();
    const dataDir = getDataDir();
    
    logger.step(1, `工作目录: ${appealDir}`);
    logger.step(2, '初始化数据库...');
    
    await initDatabase();
    
    logger.success('数据库初始化完成');
    
    if (options.sampleData) {
      logger.step(3, '导入内置样例数据...');
      const sample = getAllSampleData();
      
      const orderResult = await importOrders(sample.orders);
      logger.info(`订单数据: ${orderResult.success}/${orderResult.total} 条导入成功`);
      
      const trajResult = await importTrajectories(sample.trajectories);
      logger.info(`轨迹数据: ${trajResult.success}/${trajResult.total} 条导入成功`);
      
      const mealResult = await importMerchantMeals(sample.merchantMeals);
      logger.info(`商家出餐数据: ${mealResult.success}/${mealResult.total} 条导入成功`);
      
      const weatherResult = await importWeatherEvents(sample.weatherEvents);
      logger.info(`天气数据: ${weatherResult.success}/${weatherResult.total} 条导入成功`);
      
      const penaltyResult = await importPenalties(sample.penalties);
      logger.info(`处罚数据: ${penaltyResult.success}/${penaltyResult.total} 条导入成功`);
      
      const appealResult = await importAppeals(sample.appeals);
      logger.info(`申诉数据: ${appealResult.success}/${appealResult.total} 条导入成功`);
      
      if (orderResult.failed > 0 || appealResult.failed > 0) {
        orderResult.failures.forEach(f => logger.warn(`[订单导入失败] ${f.reason}`));
        appealResult.failures.forEach(f => logger.warn(`[申诉导入失败] ${f.reason}`));
      }
      
      logger.success('样例数据导入完成');
      logger.divider();
      logger.info('内置样例场景:');
      sample.scenarios.forEach((s, i) => {
        console.log(`  ${i + 1}. ${chalk.cyan(s.name)} - ${s.description}`);
      });
    }
    
    logger.divider();
    logger.success('系统初始化完成！');
    logger.info(`数据目录: ${appealDir}`);
    logger.info(`下一步: 使用 'appeal list' 查看申诉列表，或 'appeal check --all' 审核所有申诉`);
    
    closeDb();
  });

program
  .command('import')
  .description('导入数据到申诉系统')
  .option('-t, --type <type>', '数据类型: orders|trajectories|meals|weather|penalties|appeals')
  .option('-f, --file <file>', 'JSON 文件路径')
  .option('--sample', '导入内置样例数据')
  .action(async (options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    logger.header('导入数据');
    
    if (options.sample) {
      logger.info('导入内置样例数据...');
      const sample = getAllSampleData();
      
      const orderResult = await importOrders(sample.orders);
      logger.status('订单', `${orderResult.success}/${orderResult.total} 条`);
      
      const trajResult = await importTrajectories(sample.trajectories);
      logger.status('轨迹', `${trajResult.success}/${trajResult.total} 条`);
      
      const mealResult = await importMerchantMeals(sample.merchantMeals);
      logger.status('商家出餐', `${mealResult.success}/${mealResult.total} 条`);
      
      const weatherResult = await importWeatherEvents(sample.weatherEvents);
      logger.status('天气', `${weatherResult.success}/${weatherResult.total} 条`);
      
      const penaltyResult = await importPenalties(sample.penalties);
      logger.status('处罚', `${penaltyResult.success}/${penaltyResult.total} 条`);
      
      const appealResult = await importAppeals(sample.appeals);
      logger.status('申诉', `${appealResult.success}/${appealResult.total} 条`);
      
      if (appealResult.failures.length > 0) {
        logger.warn('导入失败的申诉:');
        appealResult.failures.forEach(f => console.log(`  - ${f.reason}`));
      }
      
      logger.success('样例数据导入完成');
      closeDb();
      return;
    }
    
    if (!options.type || !options.file) {
      logger.error('请指定数据类型和文件路径');
      logger.info('示例: appeal import -t orders -f ./data/orders.json');
      closeDb();
      process.exit(1);
    }
    
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      logger.error(`文件不存在: ${filePath}`);
      closeDb();
      process.exit(1);
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const dataArray = Array.isArray(data) ? data : [data];
      
      let result;
      switch (options.type) {
        case 'orders':
          result = await importOrders(dataArray);
          break;
        case 'trajectories':
          result = await importTrajectories(dataArray);
          break;
        case 'meals':
          result = await importMerchantMeals(dataArray);
          break;
        case 'weather':
          result = await importWeatherEvents(dataArray);
          break;
        case 'penalties':
          result = await importPenalties(dataArray);
          break;
        case 'appeals':
          result = await importAppeals(dataArray);
          break;
        default:
          logger.error(`未知数据类型: ${options.type}`);
          closeDb();
          process.exit(1);
      }
      
      logger.success(`导入完成: ${result.success}/${result.total} 条成功`);
      
      if (result.failed > 0) {
        logger.warn(`导入失败: ${result.failed} 条`);
        result.failures.forEach(f => {
          console.log(`  [${f.index}] ${f.reason}`);
        });
      }
    } catch (e: any) {
      logger.error(`导入失败: ${e.message}`);
    }
    
    closeDb();
  });

program
  .command('check')
  .description('审核申诉')
  .option('-a, --all', '审核所有待处理申诉')
  .option('-i, --id <id>', '审核指定申诉 ID')
  .option('--detail', '显示详细审核过程')
  .action(async (options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    logger.header('申诉审核');
    
    const results = options.all ? await checkPendingAppeals() :
                  options.id ? [await checkAppeal(options.id)] : [];
    
    if (results.length === 0) {
      logger.info('没有待审核的申诉');
      closeDb();
      return;
    }
    
    results.forEach((result, idx) => {
      logger.divider();
      logger.step(idx + 1, `申诉 ${result.appealId}`);
      logger.status('订单号', result.orderNo);
      logger.status('类型', result.appealType);
      logger.status('结果', result.status === 'approved' ? chalk.green('通过') : chalk.red('驳回'));
      logger.status('判定', result.finalDecision);
      
      if (result.revertedAmount && result.revertedAmount > 0) {
        logger.status('退回金额', chalk.green(`¥${result.revertedAmount.toFixed(2)}`));
      }
      
      if (options.detail && result.rules.length > 0) {
        console.log('');
        console.log(chalk.italic('  规则检查详情:'));
        result.rules.forEach(rule => {
          const status = rule.passed ? chalk.green('✓') : chalk.red('✗');
          console.log(`    ${status} ${rule.ruleId} ${rule.ruleName} (权重: ${rule.weight})`);
          console.log(`      ${rule.reason}`);
        });
        
        if (result.evidences.length > 0) {
          console.log('');
          console.log(chalk.italic('  证据清单:'));
          result.evidences.forEach(ev => {
            console.log(`    [${ev.type.toUpperCase()}] ${ev.title}`);
          });
        }
      }
    });
    
    logger.divider();
    logger.success(`审核完成，共处理 ${results.length} 条申诉`);
    closeDb();
  });

program
  .command('list')
  .description('列出申诉列表')
  .option('-s, --status <status>', '按状态过滤: pending|approved|rejected|corrected')
  .option('-t, --type <type>', '按类型过滤: timeout|bad_review|cancellation')
  .option('-r, --rider <id>', '按骑手 ID 过滤')
  .option('-o, --order <no>', '按订单号过滤')
  .action(async (options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    logger.header('申诉列表');
    
    const appeals = await listAppeals({
      status: options.status,
      appealType: options.type,
      riderId: options.rider,
      orderNo: options.order
    });
    
    if (appeals.length === 0) {
      logger.info('没有找到申诉记录');
      closeDb();
      return;
    }
    
    const table = new Table({
      head: ['ID', '订单号', '类型', '状态', '提交时间', '退回金额'],
      colWidths: [24, 22, 14, 12, 20, 12]
    });
    
    appeals.forEach(a => {
      const statusColor = a.status === 'approved' ? chalk.green :
                         a.status === 'rejected' ? chalk.red :
                         a.status === 'corrected' ? chalk.yellow :
                         chalk.cyan;
      
      table.push([
        a.id,
        a.orderNo,
        a.appealType,
        statusColor(a.status),
        new Date(a.submitTime).toLocaleString().slice(0, 19),
        a.revertedAmount ? `¥${a.revertedAmount.toFixed(2)}` : '-'
      ]);
    });
    
    console.log(table.toString());
    
    const stats = await getSummaryStats();
    logger.divider();
    logger.status('统计', `共 ${stats.total} 条 | 待审核 ${stats.pending} | 通过 ${stats.approved} | 驳回 ${stats.rejected} | 修正 ${stats.corrected}`);
    logger.status('金额', `总处罚 ¥${stats.totalPenaltyAmount.toFixed(2)} | 已退回 ¥${stats.totalRevertedAmount.toFixed(2)}`);
    
    closeDb();
  });

program
  .command('detail')
  .description('查看申诉详情')
  .argument('<id>', '申诉 ID')
  .option('-e, --evidence', '显示详细证据')
  .option('-H, --history', '显示完整历史记录')
  .action(async (id, options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    try {
      const detail = await getAppealDetail(id);
      const { appeal, order, penalty, history, corrections } = detail;
      
      logger.header('申诉详情');
      
      logger.status('申诉 ID', appeal.id);
      logger.status('订单号', appeal.orderNo);
      logger.status('骑手', `${order?.riderName || appeal.riderId} (${appeal.riderId})`);
      logger.status('申诉类型', appeal.appealType);
      logger.status('申诉状态', appeal.status);
      logger.status('提交时间', new Date(appeal.submitTime).toLocaleString());
      logger.status('申诉原因', appeal.appealReason);
      
      if (appeal.checkTime) {
        logger.status('审核时间', new Date(appeal.checkTime).toLocaleString());
      }
      
      if (appeal.checkResult) {
        logger.divider();
        logger.info(chalk.bold('审核结果:'));
        console.log(chalk.white(appeal.checkResult));
      }
      
      if (appeal.revertedAmount && appeal.revertedAmount > 0) {
        logger.status('退回金额', chalk.green(`¥${appeal.revertedAmount.toFixed(2)}`));
      }
      
      if (order) {
        logger.divider();
        logger.info(chalk.bold('订单信息:'));
        logger.status('  商家', order.merchantName);
        logger.status('  用户', order.userName);
        logger.status('  订单状态', order.status);
        if (order.status === 'cancelled') {
          logger.status('  取消原因', order.cancelReason || '未知');
          logger.status('  取消发起', order.cancelInitiator || '未知');
        }
      }
      
      if (penalty) {
        logger.divider();
        logger.info(chalk.bold('处罚信息:'));
        logger.status('  类型', penalty.penaltyType);
        logger.status('  金额', `¥${penalty.penaltyAmount.toFixed(2)}`);
        logger.status('  原因', penalty.penaltyReason);
        logger.status('  状态', penalty.status);
      }
      
      if (corrections.length > 0) {
        logger.divider();
        logger.info(chalk.bold('人工修正记录:'));
        corrections.forEach((corr, idx) => {
          console.log(`  [${idx + 1}] ${corr.operator} @ ${new Date(corr.createTime).toLocaleString()}`);
          console.log(`      状态: ${corr.beforeStatus} -> ${corr.afterStatus}`);
          console.log(`      金额: ¥${(corr.beforeRevertedAmount || 0).toFixed(2)} -> ¥${(corr.afterRevertedAmount || 0).toFixed(2)}`);
          console.log(`      原因: ${corr.reason}`);
        });
      }
      
      if (options.history) {
        logger.divider();
        logger.info(chalk.bold('完整历史记录:'));
        history.forEach((h, idx) => {
          const time = new Date(h.createTime).toLocaleString();
          const op = h.operator ? ` (${h.operator})` : '';
          const status = h.fromStatus && h.toStatus ? ` [${h.fromStatus}→${h.toStatus}]` : '';
          console.log(`  [${idx + 1}] ${time}${op} | ${h.action}${status}`);
          if (h.details) {
            console.log(`      ${h.details}`);
          }
        });
      }
      
      if (options.evidence && appeal.checkEvidence) {
        try {
          const evidence = JSON.parse(appeal.checkEvidence);
          logger.divider();
          logger.info(chalk.bold('证据详情:'));
          evidence.forEach((ev: any) => {
            console.log(`  [${ev.type.toUpperCase()}] ${ev.title}`);
            ev.content.split('\n').forEach((line: string) => {
              console.log(`    ${line}`);
            });
          });
        } catch (e) {
          // 忽略解析错误
        }
      }
      
    } catch (e: any) {
      logger.error(e.message);
    }
    
    closeDb();
  });

program
  .command('report')
  .description('生成申诉报告')
  .argument('<id>', '申诉 ID')
  .option('-f, --format <format>', '输出格式: text|json (默认: text)')
  .option('-e, --export', '导出到文件')
  .action(async (id, options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    try {
      const format = (options.format || 'text') as 'text' | 'json';
      
      if (options.export) {
        const filePath = await exportReportToFile(id, format);
        logger.success(`报告已导出: ${filePath}`);
      } else {
        const report = await generateReport(id, format);
        console.log(report);
      }
    } catch (e: any) {
      logger.error(e.message);
    }
    
    closeDb();
  });

program
  .command('correct')
  .description('人工修正申诉结果')
  .argument('<id>', '申诉 ID')
  .option('-s, --status <status>', '新状态: approved|rejected')
  .option('-a, --amount <amount>', '新的退回金额')
  .option('-r, --reason <reason>', '修正原因')
  .option('-o, --operator <name>', '操作员名称', 'admin')
  .action(async (id, options) => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    if (!options.status || !options.reason) {
      logger.error('请指定新状态和修正原因');
      closeDb();
      process.exit(1);
    }
    
    try {
      const detail = await getAppealDetail(id);
      const newAmount = options.amount !== undefined ? parseFloat(options.amount) : detail.appeal.revertedAmount || 0;
      
      await correctAppeal(id, options.status, newAmount, options.reason, options.operator);
      
      logger.success('修正完成');
      logger.status('申诉 ID', id);
      logger.status('操作员', options.operator);
      logger.status('新状态', options.status);
      logger.status('退回金额', `¥${newAmount.toFixed(2)}`);
      logger.status('修正原因', options.reason);
    } catch (e: any) {
      logger.error(e.message);
    }
    
    closeDb();
  });

program
  .command('stats')
  .description('查看统计信息')
  .action(async () => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      logger.error('数据库未初始化，请先运行 appeal init');
      process.exit(1);
    }
    
    logger.header('申诉统计');
    
    const stats = await getSummaryStats();
    
    const table = new Table({
      head: ['状态', '数量'],
      colWidths: [15, 10]
    });
    
    table.push(['待审核', stats.pending]);
    table.push(['已通过', chalk.green(stats.approved)]);
    table.push(['已驳回', chalk.red(stats.rejected)]);
    table.push(['已修正', chalk.yellow(stats.corrected)]);
    table.push(['总计', chalk.bold(stats.total)]);
    
    console.log(table.toString());
    
    logger.divider();
    logger.status('处罚总额', `¥${stats.totalPenaltyAmount.toFixed(2)}`);
    logger.status('已退回', chalk.green(`¥${stats.totalRevertedAmount.toFixed(2)}`));
    logger.status('退回率', stats.totalPenaltyAmount > 0 
      ? `${((stats.totalRevertedAmount / stats.totalPenaltyAmount) * 100).toFixed(1)}%`
      : '0%');
    
    if (Object.keys(stats.byType).length > 0) {
      logger.divider();
      logger.info('按申诉类型统计:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} 条`);
      });
    }
    
    closeDb();
  });

program
  .command('demo')
  .description('运行完整演示流程')
  .action(async () => {
    logger.header('申诉系统演示');
    
    logger.step(1, '初始化数据库...');
    await initDatabase();
    logger.success('数据库就绪');
    
    logger.step(2, '导入样例数据...');
    const sample = getAllSampleData();
    
    await importOrders(sample.orders);
    await importTrajectories(sample.trajectories);
    await importMerchantMeals(sample.merchantMeals);
    await importWeatherEvents(sample.weatherEvents);
    await importPenalties(sample.penalties);
    const appealResult = await importAppeals(sample.appeals);
    logger.success(`导入了 ${appealResult.success} 条申诉`);
    
    logger.step(3, '查看待审核申诉...');
    const pending = await listAppeals({ status: 'pending' });
    logger.info(`待审核: ${pending.length} 条`);
    
    logger.step(4, '自动审核所有申诉...');
    const results = await checkPendingAppeals();
    
    results.forEach((r, idx) => {
      const color = r.status === 'approved' ? chalk.green : chalk.red;
      console.log(`  ${idx + 1}. ${r.orderNo} (${r.appealType}) -> ${color(r.status)}`);
    });
    
    logger.step(5, '查看统计...');
    const stats = await getSummaryStats();
    logger.info(`通过: ${stats.approved}, 驳回: ${stats.rejected}, 退回金额: ¥${stats.totalRevertedAmount.toFixed(2)}`);
    
    logger.divider();
    logger.success('演示完成！');
    logger.info('');
    logger.info('可用命令:');
    logger.info('  appeal list           查看申诉列表');
    logger.info('  appeal detail <id>    查看申诉详情');
    logger.info('  appeal report <id>    生成申诉报告');
    logger.info('  appeal stats          查看统计信息');
    
    closeDb();
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});

if (process.argv.length <= 2) {
  program.outputHelp();
}
