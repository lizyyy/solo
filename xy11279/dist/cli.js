#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const db_1 = require("./db");
const import_1 = require("./import");
const shiftService_1 = require("./services/shiftService");
const reportService_1 = require("./services/reportService");
const types_1 = require("./types");
const db_2 = require("./db");
const security_1 = require("./utils/security");
const program = new commander_1.Command();
async function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}
async function init() {
    const dataDir = await ensureDataDir();
    await (0, db_1.initDatabase)(path.join(dataDir, 'db.json'));
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
        const result = await (0, import_1.importVehiclesFromCSV)(file);
        console.log(chalk_1.default.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow('\n错误详情:'));
            result.errors.forEach(err => {
                console.log(`  行 ${err.rowNumber}: ${err.error}`);
                console.log(`    建议: ${err.suggestion}`);
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`导入失败: ${error.message}`));
    }
});
program
    .command('import:chargers <file>')
    .description('从 JSON 导入充电桩数据')
    .action(async (file) => {
    await init();
    try {
        const result = await (0, import_1.importChargersFromJSON)(file);
        console.log(chalk_1.default.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow('\n错误详情:'));
            result.errors.forEach(err => {
                console.log(`  行 ${err.rowNumber}: ${err.error}`);
                console.log(`    建议: ${err.suggestion}`);
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`导入失败: ${error.message}`));
    }
});
program
    .command('import:tasks <file>')
    .description('从 CSV 导入任务数据')
    .action(async (file) => {
    await init();
    try {
        const result = await (0, import_1.importTasksFromCSV)(file);
        console.log(chalk_1.default.green(`导入完成！成功: ${result.imported}, 更新: ${result.skipped}, 失败: ${result.failed}`));
        if (result.errors.length > 0) {
            console.log(chalk_1.default.yellow('\n错误详情:'));
            result.errors.forEach(err => {
                console.log(`  行 ${err.rowNumber}: ${err.error}`);
                console.log(`    建议: ${err.suggestion}`);
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`导入失败: ${error.message}`));
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
        const shift = await (0, shiftService_1.createShiftSchedule)({
            date: options.date,
            shiftType: options.type,
            startTime: options.start,
            endTime: options.end,
            operatorIds: options.operators ? options.operators.split(',') : []
        });
        console.log(chalk_1.default.green(`排班创建成功！班次ID: ${shift.id}`));
        console.log(`  车辆分配数: ${shift.vehicleAssignments.length}`);
        console.log(`  充电桩预约数: ${shift.chargerReservations.length}`);
    }
    catch (error) {
        console.error(chalk_1.default.red(`排班失败: ${error.message}`));
    }
});
program
    .command('shift:start <shiftId>')
    .description('开始班次')
    .action(async (shiftId) => {
    await init();
    try {
        await (0, shiftService_1.startShift)(shiftId);
        console.log(chalk_1.default.green('班次已开始！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('shift:complete <shiftId>')
    .description('结束班次')
    .action(async (shiftId) => {
    await init();
    try {
        await (0, shiftService_1.completeShift)(shiftId);
        console.log(chalk_1.default.green('班次已结束！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('vehicle:lock <vehicleId> <taskId>')
    .description('锁定车辆')
    .action(async (vehicleId, taskId) => {
    await init();
    try {
        await (0, shiftService_1.lockVehicle)(vehicleId, taskId);
        console.log(chalk_1.default.green('车辆已锁定！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('vehicle:release <vehicleId>')
    .description('释放车辆')
    .option('-b, --battery <number>', '消耗电量百分比')
    .action(async (vehicleId, options) => {
    await init();
    try {
        await (0, shiftService_1.releaseVehicle)(vehicleId, options.battery ? parseInt(options.battery) : 0);
        console.log(chalk_1.default.green('车辆已释放！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('charger:lock <chargerId> <vehicleId>')
    .description('锁定充电桩')
    .action(async (chargerId, vehicleId) => {
    await init();
    try {
        await (0, shiftService_1.lockCharger)(chargerId, vehicleId);
        console.log(chalk_1.default.green('充电桩已锁定！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('charger:release <chargerId>')
    .description('释放充电桩')
    .action(async (chargerId) => {
    await init();
    try {
        await (0, shiftService_1.releaseCharger)(chargerId);
        console.log(chalk_1.default.green('充电桩已释放！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
    }
});
program
    .command('exception:report')
    .description('报告异常')
    .requiredOption('-s, --shift <id>', '班次ID')
    .requiredOption('-t, --type <type>', `异常类型 (${Object.values(types_1.ExceptionType).join('/')})`)
    .requiredOption('-d, --description <text>', '异常描述')
    .option('--vehicle <id>', '车辆ID')
    .option('--charger <id>', '充电桩ID')
    .option('--task <id>', '任务ID')
    .action(async (options) => {
    await init();
    try {
        await (0, shiftService_1.reportException)({
            shiftId: options.shift,
            type: options.type,
            vehicleId: options.vehicle,
            chargerId: options.charger,
            taskId: options.task,
            description: options.description
        });
        console.log(chalk_1.default.green('异常已报告！'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`操作失败: ${error.message}`));
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
        const report = await (0, reportService_1.generateDailyReport)(date);
        if (options.output) {
            let exportedPath;
            if (options.format === 'csv') {
                exportedPath = await (0, reportService_1.exportReportToCSV)(report, options.output);
            }
            else {
                exportedPath = await (0, reportService_1.exportReportToJSON)(report, options.output);
            }
            console.log(chalk_1.default.green(`日报已导出到: ${exportedPath}`));
        }
        else {
            console.log(chalk_1.default.blue(`\n日报 - ${date}\n`));
            console.log(`总任务数: ${report.totalTasks}`);
            console.log(`已完成: ${report.completedTasks}`);
            console.log(`异常: ${report.exceptionTasks}`);
            console.log(`使用车辆: ${report.vehiclesUsed}`);
            console.log(`平均剩余电量: ${report.averageBatteryUsage}%`);
            if (report.exceptions.length > 0) {
                console.log(chalk_1.default.yellow('\n异常统计:'));
                report.exceptions.forEach(e => {
                    console.log(`  ${e.type}: ${e.count} - ${e.description}`);
                });
            }
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`生成失败: ${error.message}`));
    }
});
program
    .command('list:vehicles')
    .description('列出所有车辆')
    .action(async () => {
    await init();
    const vehicles = await (0, db_2.getVehicles)();
    const table = new cli_table3_1.default({
        head: ['ID', '车牌号', '电量', '状态', '当前任务']
    });
    vehicles.forEach(v => {
        const masked = (0, security_1.maskSensitiveData)(v);
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
    const chargers = await (0, db_2.getChargers)();
    const table = new cli_table3_1.default({
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
    const tasks = await (0, db_2.getTasks)();
    const table = new cli_table3_1.default({
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
    const shifts = await (0, db_2.getShifts)();
    const table = new cli_table3_1.default({
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
