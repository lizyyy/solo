#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Database } from './database';
import { Prober } from './prober';
import { InquiryProcessor } from './inquiryProcessor';
import { QueryFilter } from './types';

const program = new Command();
const db = new Database();
const prober = new Prober(db);
const processor = new InquiryProcessor(db);

program
  .name('probe')
  .description('依赖探活命令行工具')
  .version('1.0.0');

program
  .command('probe-dns')
  .description('DNS探活')
  .requiredOption('--host <host>', '域名')
  .option('--timeout <ms>', '超时时间(毫秒)', '5000')
  .action(async (options) => {
    try {
      const result = await prober.probeDNS(options.host, parseInt(options.timeout));
      printProbeResult(result);
      db.close();
      process.exit(result.status === 'success' ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('probe-tcp')
  .description('TCP端口探活')
  .requiredOption('--host <host>', '主机地址')
  .requiredOption('--port <port>', '端口号')
  .option('--timeout <ms>', '超时时间(毫秒)', '5000')
  .action(async (options) => {
    try {
      const result = await prober.probeTCP(options.host, parseInt(options.port), parseInt(options.timeout));
      printProbeResult(result);
      db.close();
      process.exit(result.status === 'success' ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('probe-http')
  .description('HTTP服务探活')
  .requiredOption('--url <url>', 'URL地址')
  .option('--timeout <ms>', '超时时间(毫秒)', '5000')
  .option('--expected-status <code>', '期望状态码', '200')
  .action(async (options) => {
    try {
      const result = await prober.probeHTTP(options.url, parseInt(options.timeout), parseInt(options.expectedStatus));
      printProbeResult(result);
      db.close();
      process.exit(result.status === 'success' ? 0 : 1);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('init-data')
  .description('初始化采购询价单测试数据')
  .action(async () => {
    try {
      const inquiries = await processor.generateMockData();
      console.log(chalk.green('✓ 成功初始化测试数据'));
      console.log(`共生成 ${inquiries.length} 条采购询价单:\n`);
      inquiries.forEach((inq, index) => {
        console.log(`${index + 1}. ${chalk.cyan(inq.inquiryNo)} - ${inq.supplier}`);
        console.log(`   ${inq.materialName}`);
        console.log(`   数量: ${inq.quantity}, 总价: ¥${inq.totalPrice.toFixed(2)}`);
        console.log(`   状态: ${formatStatus(inq.status)}\n`);
      });
      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('concurrent-test')
  .description('并发写入测试')
  .requiredOption('--id <inquiryId>', '询价单ID')
  .option('--count <number>', '并发数量', '3')
  .action(async (options) => {
    try {
      await processor.simulateConcurrentWrite(options.id, parseInt(options.count));
      console.log(chalk.green('✓ 并发写入测试完成'));
      console.log(chalk.yellow(`⚠️ 注意: 询价单 ${options.id} 的状态和权限票可能已被覆盖\n`));

      const conclusions = await processor.getConclusions(options.id);
      console.log(`处理记录 (共${conclusions.length}条):`);
      conclusions.forEach((c, index) => {
        console.log(`${index + 1}. 结论: ${formatConclusion(c.conclusion)}`);
        console.log(`   原因: ${c.reason}`);
        if (c.isManualCorrection) {
          console.log(`   ${chalk.magenta('(人工修正) 备注: ' + c.correctionRemark)}`);
        }
        console.log();
      });

      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('process')
  .description('处理询价单')
  .requiredOption('--id <inquiryId>', '询价单ID')
  .requiredOption('--conclusion <conclusion>', '结论: pass/fail/review')
  .requiredOption('--reason <reason>', '处理原因')
  .action(async (options) => {
    try {
      const conclusion = await processor.processInquiry(options.id, options.conclusion, options.reason);
      console.log(chalk.green('✓ 处理成功'));
      console.log(`结论: ${formatConclusion(conclusion.conclusion)}`);
      console.log(`原因: ${conclusion.reason}\n`);
      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('correct')
  .description('人工修正处理结论')
  .requiredOption('--id <inquiryId>', '询价单ID')
  .requiredOption('--conclusion <conclusion>', '新结论: pass/fail/review')
  .requiredOption('--reason <reason>', '新原因')
  .requiredOption('--operator <operator>', '操作人')
  .requiredOption('--remark <remark>', '修正备注')
  .option('--permission-ticket <ticket>', '新的权限临时票(可选)')
  .action(async (options) => {
    try {
      const conclusion = await processor.manualCorrect(
        options.id,
        options.conclusion,
        options.reason,
        options.operator,
        options.remark,
        options.permissionTicket
      );
      console.log(chalk.green('✓ 人工修正成功'));
      console.log(chalk.magenta('⚠️ 这是人工修正记录，保留了历史变更痕迹'));
      console.log(`新结论: ${formatConclusion(conclusion.conclusion)}`);
      console.log(`新原因: ${conclusion.reason}`);
      console.log(`操作人: ${conclusion.operator}`);
      console.log(`备注: ${conclusion.correctionRemark}`);
      if (conclusion.previousConclusion) {
        console.log(`\n历史记录:`);
        console.log(`  之前结论: ${formatConclusion(conclusion.previousConclusion)}`);
        console.log(`  之前原因: ${conclusion.previousReason}`);
      }
      if (conclusion.newPermissionTicket !== undefined) {
        console.log(`\n权限临时票变更:`);
        console.log(`  变更前: ${conclusion.previousPermissionTicket || '无'}`);
        console.log(`  变更后: ${conclusion.newPermissionTicket || '无'}`);
      }
      console.log();
      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('summary')
  .description('生成询价单摘要')
  .requiredOption('--id <inquiryId>', '询价单ID')
  .action(async (options) => {
    try {
      const summary = await processor.generateSummary(options.id);
      console.log(chalk.cyan('=' + '='.repeat(50)));
      console.log(summary.summary);
      console.log(chalk.cyan('=' + '='.repeat(50)));
      console.log();
      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('query-probes')
  .description('查询探活结果')
  .option('--status <status>', '状态筛选: success/failure/all')
  .option('--dependency-id <id>', '依赖ID')
  .action(async (options) => {
    try {
      const filter: QueryFilter = {};
      if (options.status) filter.status = options.status;
      if (options.dependencyId) filter.dependencyId = options.dependencyId;

      const results = await db.queryProbeResults(filter);
      console.log(chalk.cyan(`探活结果查询 (共${results.length}条):\n`));

      results.forEach((result, index) => {
        printProbeResult(result, index + 1);
      });

      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('list-inquiries')
  .description('列出所有询价单')
  .action(async () => {
    try {
      const inquiries = await processor.getAllInquiries();
      console.log(chalk.cyan(`采购询价单列表 (共${inquiries.length}条):\n`));

      inquiries.forEach((inq, index) => {
        console.log(`${index + 1}. ID: ${chalk.yellow(inq.id)}`);
        console.log(`   询价单号: ${chalk.cyan(inq.inquiryNo)}`);
        console.log(`   供应商: ${inq.supplier}`);
        console.log(`   材料: ${inq.materialName}`);
        console.log(`   状态: ${formatStatus(inq.status)}`);
        console.log(`   权限票: ${inq.permissionTicket || '无'}\n`);
      });

      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

program
  .command('list-summaries')
  .description('列出所有摘要')
  .action(async () => {
    try {
      const summaries = await processor.getAllSummaries();
      console.log(chalk.cyan(`材料摘要列表 (共${summaries.length}条):\n`));

      summaries.forEach((summary, index) => {
        console.log(`${index + 1}. 询价单ID: ${chalk.yellow(summary.inquiryId)}`);
        console.log(summary.summary);
        console.log(chalk.cyan('-'.repeat(50)));
        console.log();
      });

      db.close();
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`错误: ${error.message}`));
      db.close();
      process.exit(2);
    }
  });

function printProbeResult(result: any, index?: number): void {
  const prefix = index ? `${index}. ` : '';
  if (result.status === 'success') {
    console.log(chalk.green(`${prefix}✓ ${result.dependencyName} - 成功`));
    console.log(`   响应时间: ${result.responseTime}ms`);
  } else {
    console.log(chalk.red(`${prefix}✗ ${result.dependencyName} - 失败`));
    console.log(`   错误类型: ${chalk.yellow(result.errorType?.toUpperCase() || 'UNKNOWN')}`);
    console.log(`   错误信息: ${result.errorMessage}`);
    console.log(`   响应时间: ${result.responseTime}ms`);
  }
  console.log();
}

function formatStatus(status: string): string {
  switch (status) {
    case 'approved':
      return chalk.green('已通过');
    case 'rejected':
      return chalk.red('已拒绝');
    case 'pending':
      return chalk.yellow('待审核');
    default:
      return status;
  }
}

function formatConclusion(conclusion: string): string {
  switch (conclusion) {
    case 'pass':
      return chalk.green('通过');
    case 'fail':
      return chalk.red('拒绝');
    case 'review':
      return chalk.yellow('复核');
    default:
      return conclusion;
  }
}

program.parseAsync(process.argv);
