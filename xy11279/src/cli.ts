#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';
import { initDatabase } from './db';
import { importVehiclesFromCSV, importChargersFromJSON, importTasksFromCSV } from './import';
import { createShiftSchedule, lockVehicle, releaseVehicle, lockCharger, releaseCharger, reportException, startShift, completeShift } from './services/shiftService';
import { generateDailyReport, exportReportToJSON, exportReportToCSV } from './services/reportService';
import { ShiftType, ExceptionType } from './types';
import { getVehicles, getChargers, getTasks, getShifts, getExceptions } from './db';
import { maskSensitiveData } from './utils/security';

const program = new Command();

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

async function init() {
  const dataDir = await ensureDataDir();
  await initDatabase(path.join(dataDir, 'db.json'));
}

program
  .name('wns')
  .description('仓库夜班管理系统')
  .version('1.0.0');

program
  .command('import:vehicles <file>')
  .description('从 CSV 导入车辆数据')
  .action(async (file) => {
    await init();
    try {
      const result = await importVehiclesFromCSV(file);
      console.log(chalk.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('\n错误详情:'));
        result.errors.forEach(err => {
          console.log(`  行 ${err.rowNumber}: ${err.error}`);
          console.log(`    建议: ${err.suggestion}`);
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
    }
  });

program
  .command('import:chargers <file>')
  .description('从 JSON 导入充电桩数据')
  .action(async (file) => {
    await init();
    try {
      const result = await importChargersFromJSON(file);
      console.log(chalk.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('\n错误详情:'));
        result.errors.forEach(err => {
          console.log(`  行 ${err.rowNumber}: ${err.error}`);
          console.log(`    建议: ${err.suggestion}`);
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
    }
  });

program
  .command('import:tasks <file>')
  .description('从 CSV 导入任务数据')
  .action(async (file) => {
    await init();
    try {
      const result = await importTasksFromCSV(file);
      console.log(chalk.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('\n错误详情:'));
        result.errors.forEach(err => {
          console.log(`  行 ${err.rowNumber}: ${err.error}`);
          console.log(`    建议: ${err.suggestion}`);
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`导入失败: ${error.message}`));
    }
  });

program
  .command('schedule:create')
  .description('创建班次排班')
  .requiredOption('-d, --date <date>', '日期 (YYYY-MM-DD)')
  .requiredOption('-t, --type <type>', '班次类型 (day/night)')
  .option('--start <time>', '开始时间 (HH:mm)', '09:00')
  .option('--end <time>', '结束时间 (HH:mm)', '18:00')
  .option('--operators <ids>', '操作员ID列表 (逗号分隔)')
  .action(async (options) => {
    await init();
    try {
      const shift = await createShiftSchedule({
        date: options.date,
        shiftType: options.type as ShiftType,
        startTime: options.start,
        endTime: options.end,
        operatorIds: options.operators ? options.operators.split(',') : []
      });
      console.log(chalk.green(`排班创建成功！班次ID: ${shift.id}`));
      console.log(`  车辆分配数: ${shift.vehicleAssignments.length}`);
      console.log(`  充电桩预约数: ${shift.chargerReservations.length}`);
    } catch (error: any) {
      console.error(chalk.red(`排班失败: ${error.message}`));
    }
  });

program
  .command('shift:start <shiftId>')
  .description('开始班次')
  .action(async (shiftId) => {
    await init();
    try {
      await startShift(shiftId);
      console.log(chalk.green('班次已开始！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('shift:complete <shiftId>')
  .description('结束班次')
  .action(async (shiftId) => {
    await init();
    try {
      await completeShift(shiftId);
      console.log(chalk.green('班次已结束！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('vehicle:lock <vehicleId> <taskId>')
  .description('锁定车辆')
  .action(async (vehicleId, taskId) => {
    await init();
    try {
      await lockVehicle(vehicleId, taskId);
      console.log(chalk.green('车辆已锁定！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('vehicle:release <vehicleId>')
  .description('释放车辆')
  .option('-b, --battery <number>', '消耗电量百分比')
  .action(async (vehicleId, options) => {
    await init();
    try {
      await releaseVehicle(vehicleId, options.battery ? parseInt(options.battery) : 0);
      console.log(chalk.green('车辆已释放！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('charger:lock <chargerId> <vehicleId>')
  .description('锁定充电桩')
  .action(async (chargerId, vehicleId) => {
    await init();
    try {
      await lockCharger(chargerId, vehicleId);
      console.log(chalk.green('充电桩已锁定！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('charger:release <chargerId>')
  .description('释放充电桩')
  .action(async (chargerId) => {
    await init();
    try {
      await releaseCharger(chargerId);
      console.log(chalk.green('充电桩已释放！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('exception:report')
  .description('报告异常')
  .requiredOption('-s, --shift <id>', '班次ID')
  .requiredOption('-t, --type <type>', `异常类型 (${Object.values(ExceptionType).join('/')})`)
  .requiredOption('-d, --description <text>', '异常描述')
  .option('--vehicle <id>', '车辆ID')
  .option('--charger <id>', '充电桩ID')
  .option('--task <id>', '任务ID')
  .action(async (options) => {
    await init();
    try {
      await reportException({
        shiftId: options.shift,
        type: options.type as ExceptionType,
        vehicleId: options.vehicle,
        chargerId: options.charger,
        taskId: options.task,
        description: options.description
      });
      console.log(chalk.green('异常已报告！'));
    } catch (error: any) {
      console.error(chalk.red(`操作失败: ${error.message}`));
    }
  });

program
  .command('report:daily <date>')
  .description('生成日报')
  .option('-f, --format <format>', '输出格式 (json/csv)', 'json')
  .option('-o, --output <dir>', '输出目录')
  .action(async (date, options) => {
    await init();
    try {
      const report = await generateDailyReport(date);
      
      if (options.output) {
        let exportedPath: string;
        if (options.format === 'csv') {
          exportedPath = await exportReportToCSV(report, options.output);
        } else {
          exportedPath = await exportReportToJSON(report, options.output);
        }
        console.log(chalk.green(`日报已导出到: ${exportedPath}`));
      } else {
        console.log(chalk.blue(`\n日报 - ${date}\n`));
        console.log(`总任务数: ${report.totalTasks}`);
        console.log(`已完成: ${report.completedTasks}`);
        console.log(`异常: ${report.exceptionTasks}`);
        console.log(`使用车辆: ${report.vehiclesUsed}`);
        console.log(`平均剩余电量: ${report.averageBatteryUsage}%`);
        
        if (report.exceptions.length > 0) {
          console.log(chalk.yellow('\n异常统计:'));
          report.exceptions.forEach(e => {
            console.log(`  ${e.type}: ${e.count} - ${e.description}`);
          });
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`生成失败: ${error.message}`));
    }
  });

program
  .command('list:vehicles')
  .description('列出所有车辆')
  .action(async () => {
    await init();
    const vehicles = await getVehicles();
    
    const table = new Table({
      head: ['ID', '车牌号', '电量', '状态', '当前任务']
    });
    
    vehicles.forEach(v => {
      const masked = maskSensitiveData(v);
      table.push([
        masked.id.substring(0, 8),
        masked.plateNumber,
        `${masked.batteryLevel}%`,
        masked.status,
        masked.currentTaskId ? masked.currentTaskId.substring(0, 8) : '-'
      ]);
    });
    
    console.log(table.toString());
  });

program
  .command('list:chargers')
  .description('列出所有充电桩')
  .action(async () => {
    await init();
    const chargers = await getChargers();
    
    const table = new Table({
      head: ['ID', '名称', '状态', '当前车辆', '功率', '位置']
    });
    
    chargers.forEach(c => {
      table.push([
        c.id.substring(0, 8),
        c.name,
        c.status,
        c.currentVehicleId ? c.currentVehicleId.substring(0, 8) : '-',
        `${c.power}kW`,
        c.location
      ]);
    });
    
    console.log(table.toString());
  });

program
  .command('list:tasks')
  .description('列出所有任务')
  .action(async () => {
    await init();
    const tasks = await getTasks();
    
    const table = new Table({
      head: ['ID', '订单号', '描述', '优先级', '状态']
    });
    
    tasks.forEach(t => {
      table.push([
        t.id.substring(0, 8),
        t.orderNumber,
        t.description.substring(0, 20),
        t.priority,
        t.status
      ]);
    });
    
    console.log(table.toString());
  });

program
  .command('list:shifts')
  .description('列出所有班次')
  .action(async () => {
    await init();
    const shifts = await getShifts();
    
    const table = new Table({
      head: ['ID', '日期', '类型', '状态', '车辆数', '任务数']
    });
    
    shifts.forEach(s => {
      const taskCount = s.vehicleAssignments.reduce((sum, a) => sum + a.taskIds.length, 0);
      table.push([
        s.id.substring(0, 8),
        s.date,
        s.type,
        s.status,
        s.vehicleAssignments.length,
        taskCount
      ]);
    });
    
    console.log(table.toString());
  });

program.parseAsync(process.argv);
