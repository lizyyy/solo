"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksCommand = tasksCommand;
const taskService_1 = require("../services/taskService");
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const types_1 = require("../types");
async function tasksCommand(options) {
    if (!(0, database_1.isDatabaseInitialized)()) {
        console.error(chalk_1.default.red('错误: 请先运行 init 命令初始化数据库'));
        return 1;
    }
    if (options.retry) {
        try {
            (0, taskService_1.retryTask)(options.retry);
            console.log(chalk_1.default.green(`✓ 任务 ${options.retry} 已标记为重试`));
            return 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('重试失败:'), error.message);
            return 1;
        }
    }
    if (options.manual) {
        try {
            (0, taskService_1.setManualTask)(options.manual);
            console.log(chalk_1.default.green(`✓ 任务 ${options.manual} 已标记为等待人工处理`));
            return 0;
        }
        catch (error) {
            console.error(chalk_1.default.red('设置失败:'), error.message);
            return 1;
        }
    }
    let tasks = [];
    let title = '';
    switch (options.status) {
        case 'pending':
            tasks = (0, taskService_1.getPendingTasks)();
            title = '等待执行的任务';
            break;
        case 'retry':
            tasks = (0, taskService_1.getRetryTasks)();
            title = '等待重试的任务';
            break;
        case 'manual':
            tasks = (0, taskService_1.getManualTasks)();
            title = '等待人工处理的任务';
            break;
        case 'failed':
            tasks = (0, taskService_1.getFailedTasks)();
            title = '永久失败的任务';
            break;
        default:
            const allTasks = [
                ...(0, taskService_1.getPendingTasks)(),
                ...(0, taskService_1.getRetryTasks)(),
                ...(0, taskService_1.getManualTasks)(),
                ...(0, taskService_1.getFailedTasks)()
            ];
            tasks = allTasks;
            title = '所有任务';
    }
    if (tasks.length === 0) {
        console.log(chalk_1.default.yellow(`暂无${title}`));
        return 0;
    }
    console.log(chalk_1.default.cyan(`${title} (共 ${tasks.length} 条):`));
    console.log('');
    const table = new cli_table3_1.default({
        head: ['任务ID', '批次ID', '类型', '状态', '重试次数', '错误信息', '创建时间'],
        colWidths: [38, 38, 15, 12, 8, 30, 20]
    });
    const statusColors = {
        [types_1.TaskStatus.PENDING]: chalk_1.default.blue,
        [types_1.TaskStatus.PROCESSING]: chalk_1.default.cyan,
        [types_1.TaskStatus.RETRY]: chalk_1.default.yellow,
        [types_1.TaskStatus.MANUAL]: chalk_1.default.magenta,
        [types_1.TaskStatus.PERMANENT_FAILED]: chalk_1.default.red,
        [types_1.TaskStatus.COMPLETED]: chalk_1.default.green,
    };
    for (const task of tasks) {
        const colorFn = statusColors[task.status] || chalk_1.default.gray;
        table.push([
            task.id.substring(0, 36),
            (task.batch_id || '-').substring(0, 36),
            task.task_type,
            colorFn(task.status),
            `${task.retry_count}/${task.max_retries}`,
            (task.error_message || '-').substring(0, 28),
            task.created_at
        ]);
    }
    console.log(table.toString());
    console.log('');
    console.log(chalk_1.default.gray('状态说明:'));
    console.log(chalk_1.default.blue('  pending    ') + ': 等待执行');
    console.log(chalk_1.default.cyan('  processing ') + ': 执行中');
    console.log(chalk_1.default.yellow('  retry      ') + ': 等待重试');
    console.log(chalk_1.default.magenta('  manual     ') + ': 等待人工处理');
    console.log(chalk_1.default.red('  permanent_failed ') + ': 永久失败');
    console.log(chalk_1.default.green('  completed  ') + ': 已完成');
    return 0;
}
