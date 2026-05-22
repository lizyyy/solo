"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRecovery = exports.stopTaskExecutor = exports.startTaskExecutor = void 0;
const taskService_1 = require("./taskService");
const reconciliationService_1 = require("./reconciliationService");
let isRunning = false;
let executorInterval = null;
const processTask = async (task) => {
    console.log(`开始处理任务: ${task.taskId}, 类型: ${task.taskType}`);
    const started = await (0, taskService_1.startTask)(task.taskId);
    if (!started) {
        console.log(`任务 ${task.taskId} 无法启动，可能已被其他进程处理`);
        return;
    }
    try {
        const payload = JSON.parse(task.payload || '{}');
        switch (task.taskType) {
            case 'reconciliation':
                await (0, reconciliationService_1.performReconciliation)(task.taskId, payload);
                break;
            default:
                throw new Error(`未知任务类型: ${task.taskType}`);
        }
        await (0, taskService_1.completeTask)(task.taskId);
        console.log(`任务完成: ${task.taskId}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        console.error(`任务失败: ${task.taskId}`, errorMessage);
        let category = 'retryable';
        if (errorMessage.includes('数据格式错误') || errorMessage.includes('配置错误')) {
            category = 'needs_manual';
        }
        else if (errorMessage.includes('永久失败') || errorMessage.includes('fatal')) {
            category = 'permanent';
        }
        const status = await (0, taskService_1.failTask)(task.taskId, errorMessage, category);
        console.log(`任务状态更新为: ${status}`);
    }
};
const startTaskExecutor = (intervalMs = 5000) => {
    if (isRunning) {
        console.log('任务执行器已在运行');
        return;
    }
    console.log('启动任务执行器...');
    (0, taskService_1.resetProcessingTasks)();
    isRunning = true;
    executorInterval = setInterval(async () => {
        try {
            const pendingTasks = await (0, taskService_1.getPendingTasks)();
            if (pendingTasks.length > 0) {
                console.log(`发现 ${pendingTasks.length} 个待处理任务`);
                for (const task of pendingTasks) {
                    await processTask(task);
                }
            }
        }
        catch (error) {
            console.error('任务执行器出错:', error);
        }
    }, intervalMs);
};
exports.startTaskExecutor = startTaskExecutor;
const stopTaskExecutor = () => {
    if (executorInterval) {
        clearInterval(executorInterval);
        executorInterval = null;
    }
    isRunning = false;
    console.log('任务执行器已停止');
};
exports.stopTaskExecutor = stopTaskExecutor;
const runRecovery = async () => {
    console.log('执行服务恢复...');
    const resetCount = await (0, taskService_1.resetProcessingTasks)();
    console.log(`恢复完成，重置了 ${resetCount} 个任务`);
    return { resetCount };
};
exports.runRecovery = runRecovery;
