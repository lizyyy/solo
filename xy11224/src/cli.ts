#!/usr/bin/env node

import * as yargs from 'yargs';
import { TicketService } from './services/ticketService';
import { ExportService } from './services/exportService';
import { TicketRepository, CabinetRepository, AuditLogRepository, MaintenanceRecordRepository } from './storage/repositories';
import { createRuleEngine } from './rules/ruleEngine';
import { FaultType, TicketStatus } from './types';

const ticketRepo = new TicketRepository();
const cabinetRepo = new CabinetRepository();
const auditLogRepo = new AuditLogRepository();
const maintenanceRepo = new MaintenanceRecordRepository();
const ruleEngine = createRuleEngine(ticketRepo, cabinetRepo, maintenanceRepo);
const ticketService = new TicketService(ticketRepo, auditLogRepo, maintenanceRepo, ruleEngine);
const exportService = new ExportService();

yargs
  .command('receive', '接单 - 创建新工单', {
    'external-id': { type: 'string', demandOption: true, describe: '外部单号' },
    'cabinet-id': { type: 'string', demandOption: true, describe: '柜机ID' },
    'cabinet-name': { type: 'string', demandOption: true, describe: '柜机名称' },
    'fault-type': { type: 'string', demandOption: true, choices: Object.values(FaultType), describe: '故障类型' },
    'description': { type: 'string', demandOption: true, describe: '故障描述' },
    'is-offline': { type: 'boolean', default: false, describe: '是否离线' },
    'operator': { type: 'string', default: 'cli', describe: '操作员' }
  }, async (argv) => {
    try {
      const result = await ticketService.receiveTicket(
        argv['external-id'],
        argv['cabinet-id'],
        argv['cabinet-name'],
        argv['fault-type'] as FaultType,
        argv.description,
        argv['is-offline'],
        argv.operator
      );
      console.log('工单处理结果:');
      console.log(JSON.stringify({
        ticketId: result.ticket.id,
        externalId: result.ticket.externalId,
        status: result.ticket.status,
        action: result.action,
        mergedInto: result.mergedInto
      }, null, 2));
    } catch (error: any) {
      console.error('接单失败:', error.message);
      process.exit(1);
    }
  })

  .command('analyze', '归因 - 分析工单根本原因', {
    'ticket-id': { type: 'string', demandOption: true, describe: '工单ID' },
    'root-cause': { type: 'string', demandOption: true, describe: '根本原因' },
    'operator': { type: 'string', default: 'cli', describe: '操作员' }
  }, async (argv) => {
    try {
      const ticket = await ticketService.analyzeTicket(argv['ticket-id'], argv['root-cause'], argv.operator);
      if (ticket) {
        console.log('工单归因成功:');
        console.log(`工单ID: ${ticket.id}, 状态: ${ticket.status}, 根本原因: ${ticket.rootCause}`);
      } else {
        console.log('工单不存在');
      }
    } catch (error: any) {
      console.error('归因失败:', error.message);
      process.exit(1);
    }
  })

  .command('dispatch', '派修 - 安排维修人员', {
    'ticket-id': { type: 'string', demandOption: true, describe: '工单ID' },
    'technician': { type: 'string', demandOption: true, describe: '维修人员' },
    'scheduled-at': { type: 'string', default: new Date().toISOString(), describe: '预约时间' },
    'operator': { type: 'string', default: 'cli', describe: '操作员' }
  }, async (argv) => {
    try {
      const ticket = await ticketService.dispatchTicket(
        argv['ticket-id'],
        argv.technician,
        new Date(argv['scheduled-at']),
        argv.operator
      );
      if (ticket) {
        console.log('工单派修成功:');
        console.log(`工单ID: ${ticket.id}, 状态: ${ticket.status}, 维修人员: ${ticket.assignedTo}`);
      } else {
        console.log('工单不存在');
      }
    } catch (error: any) {
      console.error('派修失败:', error.message);
      process.exit(1);
    }
  })

  .command('review', '复核 - 审核维修结果', {
    'ticket-id': { type: 'string', demandOption: true, describe: '工单ID' },
    'resolution': { type: 'string', demandOption: true, describe: '解决方案' },
    'status-after': { type: 'string', demandOption: true, describe: '维修后状态' },
    'operator': { type: 'string', default: 'cli', describe: '操作员' }
  }, async (argv) => {
    try {
      const ticket = await ticketService.reviewTicket(
        argv['ticket-id'],
        argv.resolution,
        argv['status-after'],
        argv.operator
      );
      if (ticket) {
        console.log('工单复核成功:');
        console.log(`工单ID: ${ticket.id}, 状态: ${ticket.status}, 解决方案: ${ticket.resolution}`);
      } else {
        console.log('工单不存在');
      }
    } catch (error: any) {
      console.error('复核失败:', error.message);
      process.exit(1);
    }
  })

  .command('resolve', '结案 - 完成工单处理', {
    'ticket-id': { type: 'string', demandOption: true, describe: '工单ID' },
    'operator': { type: 'string', default: 'cli', describe: '操作员' }
  }, async (argv) => {
    try {
      const ticket = await ticketService.resolveTicket(argv['ticket-id'], argv.operator);
      if (ticket) {
        console.log('工单结案成功:');
        console.log(`工单ID: ${ticket.id}, 状态: ${ticket.status}`);
      } else {
        console.log('工单不存在');
      }
    } catch (error: any) {
      console.error('结案失败:', error.message);
      process.exit(1);
    }
  })

  .command('list', '查询工单列表', {
    'status': { type: 'string', choices: Object.values(TicketStatus), describe: '工单状态' },
    'cabinet-id': { type: 'string', describe: '柜机ID' },
    'start-date': { type: 'string', describe: '开始日期 YYYY-MM-DD' },
    'end-date': { type: 'string', describe: '结束日期 YYYY-MM-DD' }
  }, async (argv) => {
    const tickets = await ticketService.listTickets({
      status: argv.status as TicketStatus,
      cabinetId: argv['cabinet-id'],
      startDate: argv['start-date'] ? new Date(argv['start-date']) : undefined,
      endDate: argv['end-date'] ? new Date(argv['end-date']) : undefined
    });

    console.log(`共找到 ${tickets.length} 个工单:`);
    tickets.forEach(t => {
      console.log(`- [${t.status}] ${t.externalId} - ${t.cabinetName} - ${t.faultType}`);
    });
  })

  .command('show <ticket-id>', '查看工单详情', {}, async (argv) => {
    const history = await ticketService.getTicketHistory(argv['ticket-id'] as string);
    if (!history) {
      console.log('工单不存在');
      return;
    }

    console.log('=== 工单详情 ===');
    console.log(JSON.stringify(history.ticket, null, 2));

    console.log('\n=== 规则执行结果 ===');
    history.ruleResults.forEach(r => {
      console.log(`- [${r.action}] ${r.ruleName}: ${r.reason}`);
    });

    console.log('\n=== 操作日志 ===');
    history.auditLogs.forEach(l => {
      console.log(`- [${l.timestamp.toISOString()}] ${l.action} by ${l.operator}`);
    });

    if (history.maintenanceRecords.length > 0) {
      console.log('\n=== 维修记录 ===');
      history.maintenanceRecords.forEach(m => {
        console.log(`- ${m.technician} @ ${m.scheduledAt.toISOString()}`);
      });
    }
  })

  .command('history <ticket-id>', '查看工单历史记录', {}, async (argv) => {
    const history = await ticketService.getTicketHistory(argv['ticket-id'] as string);
    if (!history) {
      console.log('工单不存在');
      return;
    }

    console.log(JSON.stringify(history, null, 2));
  })

  .command('export', '导出工单数据', {
    'status': { type: 'string', choices: Object.values(TicketStatus), describe: '工单状态' },
    'cabinet-id': { type: 'string', describe: '柜机ID' },
    'start-date': { type: 'string', describe: '开始日期 YYYY-MM-DD' },
    'end-date': { type: 'string', describe: '结束日期 YYYY-MM-DD' },
    'filename': { type: 'string', describe: '导出文件名' }
  }, async (argv) => {
    const tickets = await ticketService.exportTickets({
      status: argv.status as TicketStatus,
      cabinetId: argv['cabinet-id'],
      startDate: argv['start-date'] ? new Date(argv['start-date']) : undefined,
      endDate: argv['end-date'] ? new Date(argv['end-date']) : undefined
    });

    const filepath = await exportService.exportTicketsToCSV(tickets, argv.filename);
    console.log(`已导出 ${tickets.length} 条工单到: ${filepath}`);
  })

  .command('report', '生成月度报告', {
    'year': { type: 'number', demandOption: true, describe: '年份' },
    'month': { type: 'number', demandOption: true, describe: '月份 1-12' },
    'export': { type: 'boolean', default: true, describe: '是否导出CSV' }
  }, async (argv) => {
    const report = await ticketService.generateMonthlyReport(argv.year, argv.month);
    console.log('=== 月度报告 ===');
    console.log(JSON.stringify(report, null, 2));

    if (argv.export) {
      const filepath = await exportService.exportMonthlyReportToCSV(report);
      console.log(`\n报告已导出到: ${filepath}`);
    }
  })

  .command('cabinet add', '添加柜机', {
    'id': { type: 'string', demandOption: true, describe: '柜机ID' },
    'name': { type: 'string', demandOption: true, describe: '柜机名称' },
    'location': { type: 'string', demandOption: true, describe: '位置' },
    'is-online': { type: 'boolean', default: true, describe: '是否在线' }
  }, async (argv) => {
    const cabinet = await cabinetRepo.create({
      id: argv.id,
      name: argv.name,
      location: argv.location,
      isOnline: argv['is-online'],
      lastHeartbeat: new Date()
    });
    console.log('柜机创建成功:', cabinet);
  })

  .command('cabinet list', '列出所有柜机', {}, async () => {
    const cabinets = await cabinetRepo.findAll();
    console.log(`共 ${cabinets.length} 个柜机:`);
    cabinets.forEach(c => {
      console.log(`- [${c.isOnline ? '在线' : '离线'}] ${c.id} - ${c.name} @ ${c.location}`);
    });
  })

  .command('rules', '列出所有业务规则', {}, async () => {
    console.log('已配置的业务规则:');
    ruleEngine.getRuleNames().forEach((name, i) => {
      console.log(`${i + 1}. ${name}`);
    });
  })

  .help()
  .argv;

process.on('uncaughtException', (error) => {
  console.error('错误:', error.message);
  process.exit(1);
});