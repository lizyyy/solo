#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { initDatabase } = require('./storage/database');
const {
  ForkliftService,
  ChargingStationService,
  ShiftService,
  ChargingLockService,
  QueryService,
  DailyReportService
} = require('./business/services');
const ExportService = require('./utils/export');
const ImportService = require('./utils/import');

const forkliftService = new ForkliftService();
const stationService = new ChargingStationService();
const shiftService = new ShiftService();
const lockService = new ChargingLockService();
const queryService = new QueryService();
const reportService = new DailyReportService();
const exportService = new ExportService();
const importService = new ImportService();

function printResult(result) {
  if (result.success) {
    console.log('\x1b[32m%s\x1b[0m', result.message || '操作成功');
    if (result.data) {
      console.log(JSON.stringify(result.data, null, 2));
    }
    if (result.summary) {
      console.log('摘要:', JSON.stringify(result.summary, null, 2));
    }
  } else {
    console.log('\x1b[31m%s\x1b[0m', result.message || '操作失败');
    if (result.details) {
      console.log('详情:', JSON.stringify(result.details, null, 2));
    }
  }
}

async function main() {
  await initDatabase();

  yargs(hideBin(process.argv))
    .command({
      command: 'forklift:create <id> <name> [battery]',
      describe: '创建叉车',
      handler: async (argv) => {
        const result = await forkliftService.createForklift(argv.id, argv.name, argv.battery ? parseInt(argv.battery) : 100);
        printResult(result);
      }
    })
    .command({
      command: 'forklift:list [status]',
      describe: '列出叉车',
      handler: async (argv) => {
        const result = await forkliftService.listForklifts(argv.status);
        printResult(result);
      }
    })
    .command({
      command: 'forklift:battery <id> <level> <operator>',
      describe: '更新叉车电量',
      handler: async (argv) => {
        const result = await forkliftService.updateBattery(argv.id, parseInt(argv.level), argv.operator);
        printResult(result);
      }
    })
    .command({
      command: 'station:create <id> <name>',
      describe: '创建充电桩',
      handler: async (argv) => {
        const result = await stationService.createStation(argv.id, argv.name);
        printResult(result);
      }
    })
    .command({
      command: 'station:list [status]',
      describe: '列出充电桩',
      handler: async (argv) => {
        const result = await stationService.listStations(argv.status);
        printResult(result);
      }
    })
    .command({
      command: 'shift:create <id> <name> <type> <start> <end> <date> <manager>',
      describe: '创建班次 (type: day/night, start/end: HH:MM, date: YYYY-MM-DD)',
      handler: async (argv) => {
        const result = await shiftService.createShift(argv.id, argv.name, argv.type, argv.start, argv.end, argv.date, argv.manager);
        printResult(result);
      }
    })
    .command({
      command: 'shift:list <date>',
      describe: '列出某天的班次',
      handler: async (argv) => {
        const result = await shiftService.getShiftsByDate(argv.date);
        printResult(result);
      }
    })
    .command({
      command: 'shift:assign <shiftId> <forkliftId> <driver> <task> <startTime> <operator>',
      describe: '分配叉车到班次',
      handler: async (argv) => {
        const result = await shiftService.createAssignment(
          argv.shiftId, argv.forkliftId, argv.driver, argv.task, argv.startTime, argv.operator
        );
        printResult(result);
      }
    })
    .command({
      command: 'lock <stationId> <forkliftId> <shiftId> <driver> [duration]',
      describe: '锁定充电桩 (duration单位: 小时)',
      handler: async (argv) => {
        const result = await lockService.lockStation(
          argv.stationId, argv.forkliftId, argv.shiftId, argv.driver, 
          argv.duration ? parseInt(argv.duration) : 8
        );
        printResult(result);
      }
    })
    .command({
      command: 'release <stationId> <operator>',
      describe: '释放充电桩',
      handler: async (argv) => {
        const result = await lockService.releaseStation(argv.stationId, argv.operator);
        printResult(result);
      }
    })
    .command({
      command: 'lock:list',
      describe: '列出活跃锁桩',
      handler: async () => {
        const result = await lockService.getActiveLocks();
        printResult(result);
      }
    })
    .command({
      command: 'log:query [operator] [startDate] [endDate] [entityType] [status]',
      describe: '查询操作日志 (日期格式: YYYY-MM-DD)',
      handler: async (argv) => {
        const filters = {
          operator: argv.operator,
          startDate: argv.startDate,
          endDate: argv.endDate,
          entityType: argv.entityType,
          status: argv.status
        };
        const result = await queryService.queryLogs(filters);
        printResult(result);
      }
    })
    .command({
      command: 'exception:list [type] [severity] [handled] [startDate] [endDate]',
      describe: '查询异常 (handled: true/false, severity: high/medium/low)',
      handler: async (argv) => {
        const filters = {
          exceptionType: argv.type,
          severity: argv.severity,
          handled: argv.handled === 'true' ? true : (argv.handled === 'false' ? false : undefined),
          startDate: argv.startDate,
          endDate: argv.endDate
        };
        const result = await queryService.queryExceptions(filters);
        printResult(result);
      }
    })
    .command({
      command: 'exception:handle <id> <handler>',
      describe: '标记异常为已处理',
      handler: async (argv) => {
        const result = await queryService.handleException(argv.id, argv.handler);
        printResult(result);
      }
    })
    .command({
      command: 'report <date>',
      describe: '生成日报 (日期格式: YYYY-MM-DD)',
      handler: async (argv) => {
        const result = await reportService.generateDailyReport(argv.date);
        printResult(result);
      }
    })
    .command({
      command: 'export:logs [filename] [operator] [startDate] [endDate] [entityType] [status]',
      describe: '导出日志到CSV',
      handler: async (argv) => {
        const filters = {
          operator: argv.operator,
          startDate: argv.startDate,
          endDate: argv.endDate,
          entityType: argv.entityType,
          status: argv.status
        };
        const queryResult = await queryService.queryLogs(filters);
        if (queryResult.success) {
          const exportResult = await exportService.exportLogs(queryResult.data, argv.filename);
          printResult(exportResult);
        } else {
          printResult(queryResult);
        }
      }
    })
    .command({
      command: 'export:exceptions [filename] [type] [severity] [handled] [startDate] [endDate]',
      describe: '导出异常到CSV',
      handler: async (argv) => {
        const filters = {
          exceptionType: argv.type,
          severity: argv.severity,
          handled: argv.handled === 'true' ? true : (argv.handled === 'false' ? false : undefined),
          startDate: argv.startDate,
          endDate: argv.endDate
        };
        const queryResult = await queryService.queryExceptions(filters);
        if (queryResult.success) {
          const exportResult = await exportService.exportExceptions(queryResult.data, argv.filename);
          printResult(exportResult);
        } else {
          printResult(queryResult);
        }
      }
    })
    .command({
      command: 'export:report <date> [filename]',
      describe: '导出日报到CSV',
      handler: async (argv) => {
        const reportResult = await reportService.generateDailyReport(argv.date);
        if (reportResult.success) {
          const exportResult = await exportService.exportDailyReport(reportResult.data, argv.filename);
          printResult(exportResult);
        } else {
          printResult(reportResult);
        }
      }
    })
    .command({
      command: 'export:locks [filename]',
      describe: '导出活跃锁桩到CSV',
      handler: async (argv) => {
        const lockResult = await lockService.getActiveLocks();
        if (lockResult.success) {
          const exportResult = await exportService.exportLocks(lockResult.data, argv.filename);
          printResult(exportResult);
        } else {
          printResult(lockResult);
        }
      }
    })
    .demandCommand(1, '请指定一个命令')
    .help()
    .epilogue('叉车排班与充电管理系统')
    .argv;
}

main().catch(console.error);
