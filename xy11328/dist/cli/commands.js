"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.printTask = printTask;
exports.getStatusColor = getStatusColor;
exports.getPriorityColor = getPriorityColor;
exports.printTaskList = printTaskList;
exports.printEscortList = printEscortList;
exports.printStats = printStats;
exports.setupCommands = setupCommands;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const uuid_1 = require("uuid");
const types_1 = require("../models/types");
const taskService_1 = require("../services/taskService");
const escortService_1 = require("../services/escortService");
const storage_1 = require("../services/storage");
const sensitiveMask_1 = require("../utils/sensitiveMask");
const program = new commander_1.Command();
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN');
}
function printTask(task, showSensitive = false) {
    const displayTask = showSensitive ? task : (0, sensitiveMask_1.maskTask)(task);
    console.log('\n' + chalk_1.default.cyan('='.repeat(60)));
    console.log(chalk_1.default.yellow.bold(`任务ID: ${displayTask.id}`));
    console.log(chalk_1.default.cyan('='.repeat(60)));
    console.log(`状态: ${getStatusColor(displayTask.status)}`);
    console.log(`优先级: ${getPriorityColor(displayTask.priority)}`);
    console.log(`检查类型: ${displayTask.checkType}`);
    console.log(`检查地点: ${displayTask.checkLocation}`);
    console.log(`创建时间: ${formatDate(displayTask.createdAt)}`);
    if (displayTask.patient) {
        console.log('\n' + chalk_1.default.magenta.bold('患者信息:'));
        console.log(`  姓名: ${displayTask.patient.name}`);
        console.log(`  身份证: ${displayTask.patient.idCard}`);
        console.log(`  电话: ${displayTask.patient.phone}`);
        console.log(`  科室: ${displayTask.patient.room}`);
        if (displayTask.patient.bedNumber) {
            console.log(`  床号: ${displayTask.patient.bedNumber}`);
        }
    }
    if (displayTask.escort) {
        console.log('\n' + chalk_1.default.magenta.bold('陪检员信息:'));
        console.log(`  姓名: ${displayTask.escort.name}`);
        console.log(`  电话: ${displayTask.escort.phone}`);
        console.log(`  工号: ${displayTask.escort.employeeId}`);
    }
    if (displayTask.waitTimeMinutes !== undefined) {
        console.log(`\n等候时间: ${displayTask.waitTimeMinutes} 分钟`);
    }
    if (displayTask.serviceTimeMinutes !== undefined) {
        console.log(`服务时长: ${displayTask.serviceTimeMinutes} 分钟`);
    }
    if (displayTask.remarks) {
        console.log(`\n备注: ${displayTask.remarks}`);
    }
    if (displayTask.transferHistory && displayTask.transferHistory.length > 0) {
        console.log('\n' + chalk_1.default.magenta.bold('转派记录:'));
        displayTask.transferHistory.forEach((record, index) => {
            console.log(`  ${index + 1}. ${formatDate(record.transferredAt)}`);
            console.log(`     从陪检员 ${record.fromEscortId} 转派到 ${record.toEscortId}`);
            console.log(`     原因: ${record.reason}`);
            console.log(`     操作人: ${record.operator}`);
        });
    }
    console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
}
function getStatusColor(status) {
    const colors = {
        [types_1.TaskStatus.PENDING]: chalk_1.default.yellow,
        [types_1.TaskStatus.ASSIGNED]: chalk_1.default.blue,
        [types_1.TaskStatus.IN_PROGRESS]: chalk_1.default.magenta,
        [types_1.TaskStatus.COMPLETED]: chalk_1.default.green,
        [types_1.TaskStatus.CANCELLED]: chalk_1.default.gray,
        [types_1.TaskStatus.TIMEOUT]: chalk_1.default.red
    };
    return (colors[status] || chalk_1.default.white)(status);
}
function getPriorityColor(priority) {
    const colors = {
        [types_1.TaskPriority.NORMAL]: chalk_1.default.green,
        [types_1.TaskPriority.URGENT]: chalk_1.default.yellow,
        [types_1.TaskPriority.EMERGENCY]: chalk_1.default.red
    };
    return (colors[priority] || chalk_1.default.white)(priority);
}
function printTaskList(tasks, showSensitive = false) {
    const displayTasks = showSensitive ? tasks : (0, sensitiveMask_1.maskTaskList)(tasks);
    if (displayTasks.length === 0) {
        console.log(chalk_1.default.yellow('暂无任务记录'));
        return;
    }
    console.log('\n' + chalk_1.default.cyan('='.repeat(100)));
    console.log(chalk_1.default.white.bold('ID'.padEnd(10) +
        '状态'.padEnd(10) +
        '优先级'.padEnd(10) +
        '患者'.padEnd(12) +
        '检查类型'.padEnd(15) +
        '陪检员'.padEnd(12) +
        '等候时间'.padEnd(10) +
        '创建时间'));
    console.log(chalk_1.default.cyan('-'.repeat(100)));
    displayTasks.forEach(task => {
        const patientName = task.patient?.name || '-';
        const escortName = task.escort?.name || '-';
        const waitTime = task.waitTimeMinutes !== undefined ? `${task.waitTimeMinutes}分钟` : '-';
        console.log(task.id.slice(0, 8).padEnd(10) +
            task.status.padEnd(10) +
            task.priority.padEnd(10) +
            patientName.padEnd(12) +
            task.checkType.padEnd(15) +
            escortName.padEnd(12) +
            waitTime.padEnd(10) +
            formatDate(task.createdAt));
    });
    console.log(chalk_1.default.cyan('='.repeat(100)));
    console.log(chalk_1.default.green(`共 ${displayTasks.length} 条记录\n`));
}
function printEscortList(escorts, showSensitive = false) {
    const displayEscorts = showSensitive ? escorts : (0, sensitiveMask_1.maskEscortList)(escorts);
    if (displayEscorts.length === 0) {
        console.log(chalk_1.default.yellow('暂无陪检员记录'));
        return;
    }
    console.log('\n' + chalk_1.default.cyan('='.repeat(80)));
    console.log(chalk_1.default.white.bold('ID'.padEnd(10) +
        '姓名'.padEnd(12) +
        '电话'.padEnd(15) +
        '工号'.padEnd(12) +
        '状态'.padEnd(10) +
        '当前任务'));
    console.log(chalk_1.default.cyan('-'.repeat(80)));
    displayEscorts.forEach(escort => {
        const statusColor = escort.status === 'available' ? chalk_1.default.green :
            escort.status === 'busy' ? chalk_1.default.yellow : chalk_1.default.gray;
        console.log(escort.id.slice(0, 8).padEnd(10) +
            escort.name.padEnd(12) +
            escort.phone.padEnd(15) +
            escort.employeeId.padEnd(12) +
            statusColor(escort.status.padEnd(10)) +
            (escort.currentTaskId ? escort.currentTaskId.slice(0, 8) : '-'));
    });
    console.log(chalk_1.default.cyan('='.repeat(80)));
    console.log(chalk_1.default.green(`共 ${displayEscorts.length} 条记录\n`));
}
function printStats(stats) {
    console.log('\n' + chalk_1.default.cyan('='.repeat(60)));
    console.log(chalk_1.default.yellow.bold('               陪检任务统计'));
    console.log(chalk_1.default.cyan('='.repeat(60)));
    console.log(`总任务数: ${chalk_1.default.white.bold(stats.totalTasks)}`);
    console.log(`待分配: ${chalk_1.default.yellow(stats.pendingTasks)}  |  ` +
        `进行中: ${chalk_1.default.magenta(stats.inProgressTasks)}  |  ` +
        `已完成: ${chalk_1.default.green(stats.completedTasks)}`);
    console.log(`已取消: ${chalk_1.default.gray(stats.cancelledTasks)}  |  ` +
        `已超时: ${chalk_1.default.red(stats.timeoutTasks)}`);
    console.log('\n' + chalk_1.default.magenta.bold('时间统计:'));
    console.log(`  平均等候时间: ${chalk_1.default.cyan(stats.avgWaitTimeMinutes)} 分钟`);
    console.log(`  平均服务时长: ${chalk_1.default.cyan(stats.avgServiceTimeMinutes)} 分钟`);
    console.log(`  最长等候时间: ${chalk_1.default.red(stats.maxWaitTimeMinutes)} 分钟`);
    console.log('\n' + chalk_1.default.magenta.bold('优先级分布:'));
    console.log(`  普通: ${stats.tasksByPriority.normal}  |  ` +
        `紧急: ${stats.tasksByPriority.urgent}  |  ` +
        `特急: ${stats.tasksByPriority.emergency}`);
    if (Object.keys(stats.tasksByEscort).length > 0) {
        console.log('\n' + chalk_1.default.magenta.bold('陪检员工作量:'));
        for (const [escortId, data] of Object.entries(stats.tasksByEscort)) {
            console.log(`  ${data.name}: 已完成 ${chalk_1.default.green(data.completed)}  |  进行中 ${chalk_1.default.yellow(data.inProgress)}`);
        }
    }
    console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
}
function setupCommands() {
    program
        .name('escort')
        .description('门诊陪检员管理系统 CLI')
        .version('1.0.0');
    program
        .option('--show-sensitive', '显示敏感信息（姓名、电话、身份证等）');
    const taskCmd = program.command('task').description('任务管理');
    taskCmd
        .command('create')
        .description('创建任务')
        .requiredOption('-n, --name <name>', '患者姓名')
        .requiredOption('-i, --id-card <idCard>', '患者身份证号')
        .requiredOption('-p, --phone <phone>', '患者电话')
        .requiredOption('-r, --room <room>', '科室')
        .option('-b, --bed <bedNumber>', '床号')
        .requiredOption('-t, --type <checkType>', '检查类型')
        .requiredOption('-l, --location <checkLocation>', '检查地点')
        .option('--priority <priority>', '优先级 (normal/urgent/emergency)', 'normal')
        .option('--remarks <remarks>', '备注')
        .option('--idempotency-key <key>', '幂等键，用于防止重复提交')
        .action((options) => {
        try {
            const patient = {
                id: (0, uuid_1.v4)(),
                name: options.name,
                idCard: options.idCard,
                phone: options.phone,
                room: options.room,
                bedNumber: options.bed
            };
            const priority = options.priority;
            const task = taskService_1.taskService.createTask(patient, options.type, options.location, priority, options.remarks, options.idempotencyKey);
            console.log(chalk_1.default.green('任务创建成功！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('创建任务失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('assign <taskId> <escortId> <operator>')
        .description('派单')
        .option('--idempotency-key <key>', '幂等键')
        .action((taskId, escortId, operator, options) => {
        try {
            const task = taskService_1.taskService.assignTask(taskId, escortId, operator, options.idempotencyKey);
            console.log(chalk_1.default.green('派单成功！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('派单失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('accept <taskId> <escortId>')
        .description('接单')
        .option('--idempotency-key <key>', '幂等键')
        .action((taskId, escortId, options) => {
        try {
            const task = taskService_1.taskService.acceptTask(taskId, escortId, options.idempotencyKey);
            console.log(chalk_1.default.green('接单成功！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('接单失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('transfer')
        .description('转派任务')
        .requiredOption('--task-id <taskId>', '任务ID')
        .requiredOption('--from <fromEscortId>', '原陪检员ID')
        .requiredOption('--to <toEscortId>', '目标陪检员ID')
        .requiredOption('--reason <reason>', '转派原因')
        .requiredOption('--operator <operator>', '操作人')
        .option('--idempotency-key <key>', '幂等键')
        .action((options) => {
        try {
            const task = taskService_1.taskService.transferTask(options.taskId, options.from, options.to, options.reason, options.operator, options.idempotencyKey);
            console.log(chalk_1.default.green('转派成功！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('转派失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('complete <taskId> <escortId>')
        .description('完成任务')
        .option('--idempotency-key <key>', '幂等键')
        .action((taskId, escortId, options) => {
        try {
            const task = taskService_1.taskService.completeTask(taskId, escortId, options.idempotencyKey);
            console.log(chalk_1.default.green('任务已完成！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('完成任务失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('cancel <taskId> <reason> <operator>')
        .description('取消任务')
        .option('--idempotency-key <key>', '幂等键')
        .action((taskId, reason, operator, options) => {
        try {
            const task = taskService_1.taskService.cancelTask(taskId, reason, operator, options.idempotencyKey);
            console.log(chalk_1.default.green('任务已取消！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('取消任务失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('timeout <taskId>')
        .description('标记任务超时')
        .option('--idempotency-key <key>', '幂等键')
        .action((taskId, options) => {
        try {
            const task = taskService_1.taskService.timeoutTask(taskId, options.idempotencyKey);
            console.log(chalk_1.default.yellow('任务已标记为超时！'));
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('标记超时失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('list')
        .description('列出所有任务')
        .option('--status <status>', '按状态筛选 (pending/assigned/in_progress/completed/cancelled/timeout)')
        .option('--escort <escortId>', '按陪检员筛选')
        .action((options) => {
        try {
            let tasks = taskService_1.taskService.getAllTasks();
            if (options.status) {
                tasks = tasks.filter(t => t.status === options.status);
            }
            if (options.escort) {
                tasks = tasks.filter(t => t.escortId === options.escort);
            }
            printTaskList(tasks, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('查询失败:', error.message));
            process.exit(1);
        }
    });
    taskCmd
        .command('get <taskId>')
        .description('查看任务详情')
        .action((taskId) => {
        try {
            const task = taskService_1.taskService.getTaskById(taskId);
            if (!task) {
                console.error(chalk_1.default.red('任务不存在'));
                process.exit(1);
            }
            printTask(task, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('查询失败:', error.message));
            process.exit(1);
        }
    });
    const escortCmd = program.command('escort').description('陪检员管理');
    escortCmd
        .command('create')
        .description('创建陪检员')
        .requiredOption('-n, --name <name>', '姓名')
        .requiredOption('-p, --phone <phone>', '电话')
        .requiredOption('-e, --employee-id <employeeId>', '工号')
        .action((options) => {
        try {
            const escort = escortService_1.escortService.createEscort(options.name, options.phone, options.employeeId);
            console.log(chalk_1.default.green('陪检员创建成功！'));
            printEscortList([escort], program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('创建失败:', error.message));
            process.exit(1);
        }
    });
    escortCmd
        .command('list')
        .description('列出所有陪检员')
        .option('--available', '只显示可用陪检员')
        .action((options) => {
        try {
            const escorts = options.available
                ? escortService_1.escortService.getAvailableEscorts()
                : escortService_1.escortService.getAllEscorts();
            printEscortList(escorts, program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('查询失败:', error.message));
            process.exit(1);
        }
    });
    escortCmd
        .command('get <escortId>')
        .description('查看陪检员详情')
        .action((escortId) => {
        try {
            const escort = escortService_1.escortService.getEscortById(escortId);
            if (!escort) {
                console.error(chalk_1.default.red('陪检员不存在'));
                process.exit(1);
            }
            printEscortList([escort], program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('查询失败:', error.message));
            process.exit(1);
        }
    });
    escortCmd
        .command('update <escortId>')
        .description('更新陪检员信息')
        .option('-n, --name <name>', '姓名')
        .option('-p, --phone <phone>', '电话')
        .option('-s, --status <status>', '状态 (available/busy/offline)')
        .action((escortId, options) => {
        try {
            const updates = {};
            if (options.name)
                updates.name = options.name;
            if (options.phone)
                updates.phone = options.phone;
            if (options.status)
                updates.status = options.status;
            const escort = escortService_1.escortService.updateEscort(escortId, updates);
            console.log(chalk_1.default.green('陪检员信息已更新！'));
            printEscortList([escort], program.opts().showSensitive);
        }
        catch (error) {
            console.error(chalk_1.default.red('更新失败:', error.message));
            process.exit(1);
        }
    });
    const statsCmd = program.command('stats').description('统计分析');
    statsCmd
        .command('show')
        .description('显示统计信息')
        .option('--start <startTime>', '开始时间 (时间戳)')
        .option('--end <endTime>', '结束时间 (时间戳)')
        .action((options) => {
        try {
            const stats = taskService_1.taskService.getStatistics(options.start ? parseInt(options.start) : undefined, options.end ? parseInt(options.end) : undefined);
            printStats(stats);
        }
        catch (error) {
            console.error(chalk_1.default.red('统计失败:', error.message));
            process.exit(1);
        }
    });
    const dataCmd = program.command('data').description('数据管理');
    dataCmd
        .command('export <filePath>')
        .description('导出数据到JSON文件')
        .option('--include-sensitive', '包含敏感信息（明文）')
        .action((filePath, options) => {
        try {
            storage_1.storage.exportData(filePath, options.includeSensitive || false);
            console.log(chalk_1.default.green(`数据已导出到: ${filePath}`));
            if (!options.includeSensitive) {
                console.log(chalk_1.default.yellow('提示: 默认导出已脱敏敏感信息，如需明文导出请添加 --include-sensitive 参数'));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red('导出失败:', error.message));
            process.exit(1);
        }
    });
    dataCmd
        .command('import <filePath>')
        .description('从JSON文件导入数据')
        .action((filePath) => {
        try {
            storage_1.storage.importData(filePath);
            console.log(chalk_1.default.green('数据导入成功！'));
        }
        catch (error) {
            console.error(chalk_1.default.red('导入失败:', error.message));
            process.exit(1);
        }
    });
    dataCmd
        .command('path')
        .description('显示数据文件路径')
        .action(() => {
        console.log(chalk_1.default.cyan('数据文件路径:'), storage_1.storage.getDbPath());
    });
    dataCmd
        .command('cleanup-idempotency')
        .description('清理过期的幂等记录')
        .action(() => {
        try {
            const count = taskService_1.taskService.cleanupExpiredIdempotencyRecords();
            console.log(chalk_1.default.green(`已清理 ${count} 条过期的幂等记录`));
        }
        catch (error) {
            console.error(chalk_1.default.red('清理失败:', error.message));
            process.exit(1);
        }
    });
    return program;
}
