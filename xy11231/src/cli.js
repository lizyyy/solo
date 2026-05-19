#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { initDatabase } = require('./db/database');
const ImportService = require('./services/ImportService');
const ExportService = require('./services/ExportService');
const DeviceEvent = require('./models/DeviceEvent');
const ServiceTicket = require('./models/ServiceTicket');
const ErrorRecord = require('./models/ErrorRecord');
const ImportSession = require('./models/ImportSession');

const program = new Command();

async function main() {
  await initDatabase();

  program
    .name('bswap')
    .description('换电运营异常处理系统 - CLI工具')
    .version('1.0.0');

  program
    .command('import-events')
    .description('导入设备事件JSON文件')
    .argument('<file>', 'JSON文件路径')
    .action(async (file) => {
      try {
        console.log(chalk.blue(`正在导入设备事件: ${file}`));
        const result = await ImportService.importDeviceEvents(file);
        console.log(chalk.green(`导入完成! 总计: ${result.total}, 成功: ${result.success}, 错误: ${result.errors}`));
        if (result.errors > 0) {
          console.log(chalk.yellow('错误记录已保存，可使用 list-errors 查看'));
        }
      } catch (e) {
        console.error(chalk.red(`导入失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('import-tickets')
    .description('导入客服工单CSV文件')
    .argument('<file>', 'CSV文件路径')
    .action(async (file) => {
      try {
        console.log(chalk.blue(`正在导入客服工单: ${file}`));
        const result = await ImportService.importServiceTickets(file);
        console.log(chalk.green(`导入完成! 总计: ${result.total}, 成功: ${result.success}, 错误: ${result.errors}`));
        if (result.errors > 0) {
          console.log(chalk.yellow('错误记录已保存，可使用 list-errors 查看'));
        }
      } catch (e) {
        console.error(chalk.red(`导入失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('list-events')
    .description('列出设备事件')
    .option('-l, --limit <number>', '显示数量', '50')
    .option('-s, --status <status>', '按状态筛选')
    .option('-a, --assignee <name>', '按负责人筛选')
    .option('-t, --type <type>', '按事件类型筛选')
    .option('--station <id>', '按站点ID筛选')
    .option('--start <time>', '开始时间')
    .option('--end <time>', '结束时间')
    .action(async (options) => {
      try {
        const filterOptions = {
          limit: parseInt(options.limit),
          status: options.status,
          assignee: options.assignee,
          eventType: options.type,
          stationId: options.station,
          startTime: options.start,
          endTime: options.end
        };
        
        const events = await DeviceEvent.filter(filterOptions);
        printDeviceEventsTable(events);
      } catch (e) {
        console.error(chalk.red(`查询失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('list-tickets')
    .description('列出客服工单')
    .option('-l, --limit <number>', '显示数量', '50')
    .option('-s, --status <status>', '按状态筛选')
    .option('-a, --assignee <name>', '按负责人筛选')
    .option('-i, --issue <type>', '按问题类型筛选')
    .option('-p, --priority <level>', '按优先级筛选')
    .option('--station <id>', '按站点ID筛选')
    .option('--start <time>', '开始时间')
    .option('--end <time>', '结束时间')
    .action(async (options) => {
      try {
        const filterOptions = {
          limit: parseInt(options.limit),
          status: options.status,
          assignee: options.assignee,
          issueType: options.issue,
          priority: options.priority,
          stationId: options.station,
          startTime: options.start,
          endTime: options.end
        };
        
        const tickets = await ServiceTicket.filter(filterOptions);
        printServiceTicketsTable(tickets);
      } catch (e) {
        console.error(chalk.red(`查询失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('list-errors')
    .description('列出错误记录')
    .option('-l, --limit <number>', '显示数量', '50')
    .option('--unresolved', '只显示未解决的错误')
    .option('--source <type>', '按来源类型筛选')
    .action(async (options) => {
      try {
        const filterOptions = {
          limit: parseInt(options.limit),
          sourceType: options.source,
          resolved: options.unresolved ? false : undefined
        };
        
        const errors = await ErrorRecord.filter(filterOptions);
        printErrorsTable(errors);
      } catch (e) {
        console.error(chalk.red(`查询失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('list-sessions')
    .description('列出导入会话历史')
    .action(async () => {
      try {
        const sessions = await ImportSession.getAll();
        printSessionsTable(sessions);
      } catch (e) {
        console.error(chalk.red(`查询失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('resolve-error')
    .description('标记错误为已解决')
    .argument('<id>', '错误记录ID')
    .action(async (id) => {
      try {
        const success = await ErrorRecord.markResolved(parseInt(id));
        if (success) {
          console.log(chalk.green(`错误记录 #${id} 已标记为已解决`));
        } else {
          console.log(chalk.red(`错误记录 #${id} 不存在`));
        }
      } catch (e) {
        console.error(chalk.red(`操作失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('update-event')
    .description('更新设备事件')
    .argument('<id>', '事件ID')
    .option('-s, --status <status>', '更新状态')
    .option('-a, --assignee <name>', '更新负责人')
    .action(async (id, options) => {
      try {
        const updates = {};
        if (options.status) updates.status = options.status;
        if (options.assignee) updates.assignee = options.assignee;
        
        const success = await DeviceEvent.update(parseInt(id), updates);
        if (success) {
          console.log(chalk.green(`设备事件 #${id} 已更新`));
        } else {
          console.log(chalk.red(`设备事件 #${id} 不存在或无更新`));
        }
      } catch (e) {
        console.error(chalk.red(`更新失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('update-ticket')
    .description('更新客服工单')
    .argument('<id>', '工单ID')
    .option('-s, --status <status>', '更新状态')
    .option('-a, --assignee <name>', '更新负责人')
    .option('-p, --priority <level>', '更新优先级')
    .action(async (id, options) => {
      try {
        const updates = {};
        if (options.status) updates.status = options.status;
        if (options.assignee) updates.assignee = options.assignee;
        if (options.priority) updates.priority = options.priority;
        
        const success = await ServiceTicket.update(parseInt(id), updates);
        if (success) {
          console.log(chalk.green(`客服工单 #${id} 已更新`));
        } else {
          console.log(chalk.red(`客服工单 #${id} 不存在或无更新`));
        }
      } catch (e) {
        console.error(chalk.red(`更新失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('export-events')
    .description('导出设备事件')
    .option('-o, --output <path>', '输出文件路径')
    .option('-s, --status <status>', '按状态筛选')
    .option('-a, --assignee <name>', '按负责人筛选')
    .action(async (options) => {
      try {
        const filterOptions = {
          status: options.status,
          assignee: options.assignee
        };
        
        const result = await ExportService.exportDeviceEvents(filterOptions, options.output);
        console.log(chalk.green(`导出成功! 文件: ${result.filePath}, 记录数: ${result.recordCount}`));
      } catch (e) {
        console.error(chalk.red(`导出失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('export-tickets')
    .description('导出客服工单')
    .option('-o, --output <path>', '输出文件路径')
    .option('-s, --status <status>', '按状态筛选')
    .option('-a, --assignee <name>', '按负责人筛选')
    .action(async (options) => {
      try {
        const filterOptions = {
          status: options.status,
          assignee: options.assignee
        };
        
        const result = await ExportService.exportServiceTickets(filterOptions, options.output);
        console.log(chalk.green(`导出成功! 文件: ${result.filePath}, 记录数: ${result.recordCount}`));
      } catch (e) {
        console.error(chalk.red(`导出失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('export-errors')
    .description('导出错误记录')
    .option('-o, --output <path>', '输出文件路径')
    .option('--unresolved', '只导出未解决的错误')
    .action(async (options) => {
      try {
        const filterOptions = {
          resolved: options.unresolved ? false : undefined
        };
        
        const result = await ExportService.exportErrors(filterOptions, options.output);
        console.log(chalk.green(`导出成功! 文件: ${result.filePath}, 记录数: ${result.recordCount}`));
      } catch (e) {
        console.error(chalk.red(`导出失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('export-report')
    .description('导出综合报告')
    .option('-o, --output <path>', '输出文件路径')
    .option('-a, --assignee <name>', '按负责人筛选')
    .option('--start <time>', '开始时间')
    .option('--end <time>', '结束时间')
    .action(async (options) => {
      try {
        const filterOptions = {
          assignee: options.assignee,
          startTime: options.start,
          endTime: options.end
        };
        
        const result = await ExportService.exportCombinedReport(filterOptions, options.output);
        console.log(chalk.green(`导出成功! 文件: ${result.filePath}, 记录数: ${result.recordCount}`));
      } catch (e) {
        console.error(chalk.red(`导出失败: ${e.message}`));
        process.exit(1);
      }
    });

  program
    .command('summary')
    .description('显示统计摘要')
    .action(async () => {
      try {
        await printSummary();
      } catch (e) {
        console.error(chalk.red(`统计失败: ${e.message}`));
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

function printDeviceEventsTable(events) {
  if (events.length === 0) {
    console.log(chalk.yellow('没有找到设备事件记录'));
    return;
  }

  const table = new Table({
    head: ['ID', '设备ID', '事件类型', '时间', '状态', '负责人', '错误信息'],
    colWidths: [6, 12, 15, 22, 10, 10, 30]
  });

  events.forEach(e => {
    table.push([
      e.id,
      e.device_id,
      e.event_type,
      e.event_time.substring(0, 19),
      e.status,
      e.assignee || '-',
      (e.error_message || '').substring(0, 25)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.blue(`共 ${events.length} 条记录`));
}

function printServiceTicketsTable(tickets) {
  if (tickets.length === 0) {
    console.log(chalk.yellow('没有找到客服工单记录'));
    return;
  }

  const table = new Table({
    head: ['ID', '工单ID', '问题类型', '状态', '优先级', '负责人', '创建时间'],
    colWidths: [6, 12, 15, 10, 10, 10, 22]
  });

  tickets.forEach(t => {
    table.push([
      t.id,
      t.ticket_id,
      (t.issue_type || '-').substring(0, 12),
      t.status,
      t.priority || '-',
      t.assignee || '-',
      (t.created_time || '').substring(0, 19)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.blue(`共 ${tickets.length} 条记录`));
}

function printErrorsTable(errors) {
  if (errors.length === 0) {
    console.log(chalk.yellow('没有找到错误记录'));
    return;
  }

  const table = new Table({
    head: ['ID', '来源', '行号', '错误类型', '错误信息', '状态'],
    colWidths: [6, 15, 8, 15, 40, 10]
  });

  errors.forEach(e => {
    table.push([
      e.id,
      e.source_type,
      e.row_number || '-',
      e.error_type,
      e.error_message.substring(0, 35),
      e.resolved ? '已解决' : '未解决'
    ]);
  });

  console.log(table.toString());
  console.log(chalk.blue(`共 ${errors.length} 条记录`));
}

function printSessionsTable(sessions) {
  if (sessions.length === 0) {
    console.log(chalk.yellow('没有找到导入会话记录'));
    return;
  }

  const table = new Table({
    head: ['ID', '来源类型', '文件名', '导入时间', '总计', '成功', '错误'],
    colWidths: [6, 15, 20, 22, 8, 8, 8]
  });

  sessions.forEach(s => {
    table.push([
      s.id,
      s.source_type,
      s.source_file,
      s.imported_at.substring(0, 19),
      s.total_records,
      s.success_count,
      s.error_count
    ]);
  });

  console.log(table.toString());
}

async function printSummary() {
  const eventSummary = await DeviceEvent.getSummary();
  const ticketSummary = await ServiceTicket.getSummary();
  const errorSummary = await ErrorRecord.getSummary();

  console.log('\n' + chalk.bold.blue('=== 设备事件统计 ==='));
  if (eventSummary.length > 0) {
    const eventTable = new Table({
      head: ['状态', '事件类型', '数量', '设备数'],
      colWidths: [12, 20, 10, 10]
    });
    eventSummary.forEach(s => eventTable.push([s.status, s.event_type, s.count, s.device_count]));
    console.log(eventTable.toString());
  } else {
    console.log(chalk.yellow('暂无数据'));
  }

  console.log('\n' + chalk.bold.blue('=== 客服工单统计 ==='));
  if (ticketSummary.length > 0) {
    const ticketTable = new Table({
      head: ['状态', '问题类型', '优先级', '数量'],
      colWidths: [12, 20, 12, 10]
    });
    ticketSummary.forEach(s => ticketTable.push([s.status, s.issue_type || '-', s.priority || '-', s.count]));
    console.log(ticketTable.toString());
  } else {
    console.log(chalk.yellow('暂无数据'));
  }

  console.log('\n' + chalk.bold.blue('=== 错误记录统计 ==='));
  if (errorSummary.length > 0) {
    const errorTable = new Table({
      head: ['来源类型', '错误类型', '状态', '数量'],
      colWidths: [15, 20, 12, 10]
    });
    errorSummary.forEach(s => errorTable.push([s.source_type, s.error_type, s.resolved ? '已解决' : '未解决', s.count]));
    console.log(errorTable.toString());
  } else {
    console.log(chalk.yellow('暂无数据'));
  }
  console.log('');
}

main().catch(e => {
  console.error(chalk.red(`初始化失败: ${e.message}`));
  process.exit(1);
});
