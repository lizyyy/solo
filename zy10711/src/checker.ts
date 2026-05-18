import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { SearchIndexTask, WindowConflict, TaskDelay, CheckResult } from './types';
import { StableLogger } from './logger';

dayjs.extend(isBetween);

export class SearchIndexWindowChecker {
  private logger: StableLogger;

  constructor(logger: StableLogger) {
    this.logger = logger;
  }

  check(tasks: SearchIndexTask[]): CheckResult {
    this.logger.info('开始搜索索引任务重建窗口排查', { totalTasks: tasks.length });

    const result: CheckResult = {
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

  private findCrossDayWindows(tasks: SearchIndexTask[]): SearchIndexTask[] {
    const crossDayTasks = tasks.filter(task => {
      const start = dayjs(task.startTime);
      const end = dayjs(task.endTime);
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

  private findFailedRetries(tasks: SearchIndexTask[]): SearchIndexTask[] {
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

  private findLargeIndexConcurrent(tasks: SearchIndexTask[]): SearchIndexTask[] {
    const largeTasks = tasks.filter(t => t.isLargeIndex);
    const concurrentTasks: SearchIndexTask[] = [];

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

  private findWindowConflicts(tasks: SearchIndexTask[]): WindowConflict[] {
    const conflicts: WindowConflict[] = [];

    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const task1 = tasks[i];
        const task2 = tasks[j];

        if (this.isTimeOverlap(task1, task2)) {
          const conflict: WindowConflict = {
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

  private findTaskDelays(tasks: SearchIndexTask[]): TaskDelay[] {
    const delays: TaskDelay[] = [];
    const scheduledDelayThreshold = 30;

    tasks.forEach(task => {
      const expectedStart = dayjs(task.startTime);
      const actualStart = dayjs(task.startTime).add(0, 'minute');
      
      if (task.status === 'pending') {
        const now = dayjs();
        const delayMinutes = now.diff(expectedStart, 'minute');
        
        if (delayMinutes > scheduledDelayThreshold) {
          const delay: TaskDelay = {
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

  private isTimeOverlap(task1: SearchIndexTask, task2: SearchIndexTask): boolean {
    const start1 = dayjs(task1.startTime);
    const end1 = dayjs(task1.endTime);
    const start2 = dayjs(task2.startTime);
    const end2 = dayjs(task2.endTime);

    return start1.isBefore(end2) && start2.isBefore(end1);
  }
}
