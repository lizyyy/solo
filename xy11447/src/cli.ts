#!/usr/bin/env node
import { Command } from 'commander';
import { queueService } from './service';
import { DataSource, RetryCategory, WorkOrderStatus } from './types';
import * as fs from 'fs';

const program = new Command();

program
  .name('cp-queue')
  .description('充电桩巡检重试补偿队列 CLI')
  .version('1.0.0');

program
  .command('create')
  .description('创建工单')
  .requiredOption('-s, --source <source>', '数据源 (pile_alarm|inspection|customer_complaint|store_handover)')
  .requiredOption('--source-id <sourceId>', '来源ID')
  .requiredOption('--data <data>', '来源数据 (JSON字符串)')
  .requiredOption('-o, --operator <operator>', '操作者')
  .option('--max-retries <number>', '最大重试次数', '3')
  .action(async (options) => {
    try {
      const sourceData = JSON.parse(options.data);
      const workOrder = queueService.createWorkOrder({
        source: options.source as DataSource,
        sourceId: options.sourceId,
        sourceData,
        maxRetries: parseInt(options.maxRetries),
        operator: options.operator,
      });
      console.log(JSON.stringify(workOrder, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('创建失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('查询工单列表')
  .option('--status <status>', '状态过滤')
  .option('--source <source>', '来源过滤')
  .option('--category <category>', '重试分类过滤')
  .option('--page <number>', '页码', '1')
  .option('--page-size <number>', '每页数量', '20')
  .option('--format <format>', '输出格式 (json|table)', 'json')
  .action(async (options) => {
    try {
      const result = queueService.queryWorkOrders({
        status: options.status as WorkOrderStatus,
        source: options.source as DataSource,
        retryCategory: options.category as RetryCategory,
        page: parseInt(options.page),
        pageSize: parseInt(options.pageSize),
      });

      if (options.format === 'table') {
        console.table(result.data.map(o => ({
          工单号: o.orderNo,
          来源: o.source,
          状态: o.status,
          重试次数: o.retryCount,
          分类: o.retryCategory || '-',
          故障时长: o.faultDurationMinutes ? `${o.faultDurationMinutes}分钟` : '-',
          创建时间: o.createdAt.toISOString(),
        })));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('get <id>')
  .description('获取工单详情')
  .action(async (id) => {
    try {
      const workOrder = queueService.getWorkOrder(id);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log(JSON.stringify(workOrder, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('history <id>')
  .description('获取工单状态历史')
  .action(async (id) => {
    try {
      const history = queueService.getStatusHistory(id);
      console.log(JSON.stringify(history, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('enqueue <id>')
  .description('加入重试队列')
  .requiredOption('-o, --operator <operator>', '操作者')
  .action(async (id, options) => {
    try {
      const workOrder = queueService.enqueueWorkOrder(id, options.operator);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log('已加入队列:', workOrder.orderNo);
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('retry <id>')
  .description('重试工单')
  .requiredOption('-o, --operator <operator>', '操作者')
  .requiredOption('-c, --category <category>', '重试分类 (network_issue|system_error|data_inconsistency|pending_confirmation|other)')
  .action(async (id, options) => {
    try {
      const workOrder = queueService.retryWorkOrder(id, options.operator, options.category as RetryCategory);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log('重试中:', workOrder.orderNo, '重试次数:', workOrder.retryCount);
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('manual <id>')
  .description('人工接管')
  .requiredOption('-o, --operator <operator>', '操作者')
  .requiredOption('-r, --reason <reason>', '原因')
  .action(async (id, options) => {
    try {
      const workOrder = queueService.manualTakeover(id, options.operator, options.reason);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log('已人工接管:', workOrder.orderNo);
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('compensate <id>')
  .description('补偿入账')
  .requiredOption('-o, --operator <operator>', '操作者')
  .requiredOption('-a, --amount <number>', '补偿金额')
  .action(async (id, options) => {
    try {
      const amount = parseFloat(options.amount);
      const workOrder = queueService.compensateWorkOrder(id, options.operator, amount);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log('补偿完成:', workOrder.orderNo, '金额:', amount);
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('close <id>')
  .description('关闭工单')
  .requiredOption('-o, --operator <operator>', '操作者')
  .requiredOption('-r, --reason <reason>', '原因')
  .action(async (id, options) => {
    try {
      const workOrder = queueService.closeWorkOrder(id, options.operator, options.reason);
      if (!workOrder) {
        console.error('工单不存在');
        process.exit(1);
      }
      console.log('已关闭:', workOrder.orderNo);
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('dirty')
  .description('查看脏记录')
  .option('--work-order-id <id>', '工单ID过滤')
  .action(async (options) => {
    try {
      const records = queueService.getDirtyRecords(options.workOrderId);
      console.log(JSON.stringify(records, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('resolve-dirty <id>')
  .description('解决脏记录')
  .requiredOption('-o, --operator <operator>', '操作者')
  .requiredOption('--opinion <opinion>', '处理意见')
  .action(async (id, options) => {
    try {
      const record = queueService.resolveDirtyRecord(id, options.operator, options.opinion);
      if (!record) {
        console.error('记录不存在');
        process.exit(1);
      }
      console.log('已解决');
      process.exit(0);
    } catch (error) {
      console.error('操作失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('dashboard')
  .description('片区经理看板')
  .option('--format <format>', '输出格式 (json|table)', 'json')
  .action(async (options) => {
    try {
      const dashboard = queueService.getAreaManagerDashboard();
      
      if (options.format === 'table') {
        console.log('=== 可重试分类 ===');
        console.table(dashboard.retryableByCategory);
        console.log('\n=== 死信统计 ===');
        console.log('总数:', dashboard.deadLetterStats.total);
        console.log('按分类:');
        console.table(dashboard.deadLetterStats.byCategory);
        console.log('按来源:');
        console.table(dashboard.deadLetterStats.bySource);
        console.log('\n=== 其他 ===');
        console.log('恢复后续跑:', dashboard.recoveryFollowUps);
        console.log('待人工接管:', dashboard.pendingManualTakeover);
      } else {
        console.log(JSON.stringify(dashboard, null, 2));
      }
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出工单数据')
  .option('--status <status>', '状态过滤')
  .option('--source <source>', '来源过滤')
  .requiredOption('-f, --format <format>', '格式 (json|csv)')
  .requiredOption('-o, --output <path>', '输出文件路径')
  .action(async (options) => {
    try {
      const data = queueService.exportWorkOrders({
        status: options.status as WorkOrderStatus,
        source: options.source as DataSource,
      });

      if (options.format === 'json') {
        fs.writeFileSync(options.output, JSON.stringify(data, null, 2));
      } else if (options.format === 'csv') {
        const headers = ['工单号,来源,状态,重试次数,重试分类,故障时长(分钟),补偿金额,创建时间,关闭时间'];
        const rows = data.map(o => [
          o.orderNo,
          o.source,
          o.status,
          o.retryCount,
          o.retryCategory || '',
          o.faultDurationMinutes || '',
          o.compensationAmount || '',
          o.createdAt.toISOString(),
          o.closedAt?.toISOString() || '',
        ].join(','));
        fs.writeFileSync(options.output, [...headers, ...rows].join('\n'));
      }

      console.log(`已导出 ${data.length} 条记录到 ${options.output}`);
      process.exit(0);
    } catch (error) {
      console.error('导出失败:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
