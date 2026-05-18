"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndexWindowChecker = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const isBetween_1 = __importDefault(require("dayjs/plugin/isBetween"));
dayjs_1.default.extend(isBetween_1.default);
class SearchIndexWindowChecker {
    constructor(logger) {
        this.logger = logger;
    }
    check(tasks) {
        this.logger.info('开始搜索索引任务重建窗口排查', { totalTasks: tasks.length });
        const result = {
            windowConflicts: [],
            taskDelays: [],
            crossDayWindows: [],
            failedRetries: [],
            largeIndexConcurrent: []
        };
        result.crossDayWindows = this.findCrossDayWindows(tasks);
        this.logger.info('跨天窗口检查完成', { count: result.crossDayWindows.length });
        result.failedRetries = this.findFailedRetries(tasks);
        this.logger.info('失败重试检查完成', { count: result.failedRetries.length });
        result.largeIndexConcurrent = this.findLargeIndexConcurrent(tasks);
        this.logger.info('大索引并发检查完成', { count: result.largeIndexConcurrent.length });
        result.windowConflicts = this.findWindowConflicts(tasks);
        this.logger.info('窗口冲突检查完成', { count: result.windowConflicts.length });
        result.taskDelays = this.findTaskDelays(tasks);
        this.logger.info('任务拖延检查完成', { count: result.taskDelays.length });
        this.logger.info('搜索索引任务重建窗口排查完成', {
            totalTasks: tasks.length,
            conflicts: result.windowConflicts.length,
            delays: result.taskDelays.length,
            crossDay: result.crossDayWindows.length,
            failedRetries: result.failedRetries.length,
            largeConcurrent: result.largeIndexConcurrent.length
        });
        return result;
    }
    findCrossDayWindows(tasks) {
        const crossDayTasks = tasks.filter(task => {
            const start = (0, dayjs_1.default)(task.startTime);
            const end = (0, dayjs_1.default)(task.endTime);
            const isCrossDay = !start.isSame(end, 'day');
            if (isCrossDay) {
                this.logger.warn('发现跨天窗口任务', {
                    taskId: task.id,
                    indexName: task.indexName,
                    startTime: task.startTime,
                    endTime: task.endTime,
                    sourceFile: task.sourceFile,
                    sourceLine: task.sourceLine
                });
            }
            return isCrossDay;
        });
        return crossDayTasks;
    }
    findFailedRetries(tasks) {
        const failedTasks = tasks.filter(task => {
            const isFailedRetry = task.retryCount > 0 && task.status === 'retrying';
            if (isFailedRetry) {
                this.logger.warn('发现失败重试任务', {
                    taskId: task.id,
                    indexName: task.indexName,
                    retryCount: task.retryCount,
                    status: task.status,
                    sourceFile: task.sourceFile,
                    sourceLine: task.sourceLine
                });
            }
            return isFailedRetry;
        });
        return failedTasks;
    }
    findLargeIndexConcurrent(tasks) {
        const largeTasks = tasks.filter(t => t.isLargeIndex);
        const concurrentTasks = [];
        for (let i = 0; i < largeTasks.length; i++) {
            for (let j = i + 1; j < largeTasks.length; j++) {
                const task1 = largeTasks[i];
                const task2 = largeTasks[j];
                if (this.isTimeOverlap(task1, task2)) {
                    if (!concurrentTasks.includes(task1)) {
                        concurrentTasks.push(task1);
                        this.logger.warn('发现大索引并发任务', {
                            taskId: task1.id,
                            indexName: task1.indexName,
                            concurrentWith: task2.id,
                            sourceFile: task1.sourceFile,
                            sourceLine: task1.sourceLine
                        });
                    }
                    if (!concurrentTasks.includes(task2)) {
                        concurrentTasks.push(task2);
                    }
                }
            }
        }
        return concurrentTasks;
    }
    findWindowConflicts(tasks) {
        const conflicts = [];
        for (let i = 0; i < tasks.length; i++) {
            for (let j = i + 1; j < tasks.length; j++) {
                const task1 = tasks[i];
                const task2 = tasks[j];
                if (this.isTimeOverlap(task1, task2)) {
                    const conflict = {
                        type: 'overlap',
                        task1,
                        task2,
                        description: `任务 ${task1.indexName} 与任务 ${task2.indexName} 时间窗口重叠`
                    };
                    conflicts.push(conflict);
                    this.logger.warn('发现窗口冲突', {
                        type: 'overlap',
                        task1Id: task1.id,
                        task1Index: task1.indexName,
                        task2Id: task2.id,
                        task2Index: task2.indexName,
                        task1Source: `${task1.sourceFile}:${task1.sourceLine}`,
                        task2Source: `${task2.sourceFile}:${task2.sourceLine}`
                    });
                }
            }
        }
        return conflicts;
    }
    findTaskDelays(tasks) {
        const delays = [];
        const scheduledDelayThreshold = 30;
        tasks.forEach(task => {
            const expectedStart = (0, dayjs_1.default)(task.startTime);
            const actualStart = (0, dayjs_1.default)(task.startTime).add(0, 'minute');
            if (task.status === 'pending') {
                const now = (0, dayjs_1.default)();
                const delayMinutes = now.diff(expectedStart, 'minute');
                if (delayMinutes > scheduledDelayThreshold) {
                    const delay = {
                        task,
                        expectedStartTime: task.startTime,
                        actualStartTime: '',
                        delayMinutes,
                        description: `任务 ${task.indexName} 拖延超过 ${scheduledDelayThreshold} 分钟仍未开始`
                    };
                    delays.push(delay);
                    this.logger.warn('发现任务拖延', {
                        taskId: task.id,
                        indexName: task.indexName,
                        delayMinutes,
                        threshold: scheduledDelayThreshold,
                        sourceFile: task.sourceFile,
                        sourceLine: task.sourceLine
                    });
                }
            }
        });
        return delays;
    }
    isTimeOverlap(task1, task2) {
        const start1 = (0, dayjs_1.default)(task1.startTime);
        const end1 = (0, dayjs_1.default)(task1.endTime);
        const start2 = (0, dayjs_1.default)(task2.startTime);
        const end2 = (0, dayjs_1.default)(task2.endTime);
        return start1.isBefore(end2) && start2.isBefore(end1);
    }
}
exports.SearchIndexWindowChecker = SearchIndexWindowChecker;
