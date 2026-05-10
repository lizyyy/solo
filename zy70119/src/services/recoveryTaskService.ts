import db from '../database';
import { RecoveryTask, TaskStatus, StatusType, SourceType, OfflineReason, BusinessResponse } from '../types';
import { generateId, now, successResponse, errorResponse, formatBusinessTime, taskStatusDesc } from '../utils/business';
import channelStatusService from './channelStatusService';
import inventoryService from './inventoryService';

export const recoveryTaskService = {
  createTask: (
    storeId: string,
    itemId: string,
    channelIds: string[],
    scheduledTime: string,
    reason: string,
    createdBy: string
  ): BusinessResponse => {
    if (channelIds.length === 0) {
      return errorResponse('ERR-RT-001', '至少需要指定一个恢复渠道');
    }

    const scheduled = new Date(scheduledTime);
    if (isNaN(scheduled.getTime())) {
      return errorResponse('ERR-RT-002', '计划时间格式无效');
    }
    if (scheduled < new Date()) {
      return errorResponse('ERR-RT-003', '计划时间不能早于当前时间');
    }

    const pendingTasks = recoveryTaskService.getPendingTasks(storeId, itemId);
    for (const chId of channelIds) {
      const hasPending = pendingTasks.some(t => t.channelIds.includes(chId));
      if (hasPending) {
        return errorResponse('WARN-RT-001', '该商品在部分渠道已有待执行的恢复任务，请先取消或等待执行');
      }
    }

    try {
      const task: RecoveryTask = {
        id: generateId('rt'),
        storeId,
        itemId,
        channelIds,
        scheduledTime,
        status: TaskStatus.PENDING,
        executedAt: null,
        createdBy,
        createdAt: now(),
        reason
      };
      db.addRecoveryTask(task);

      return successResponse(
        `恢复任务创建成功，计划于${formatBusinessTime(scheduledTime)}执行`,
        {
          任务ID: task.id,
          门店ID: storeId,
          商品ID: itemId,
          渠道数量: channelIds.length,
          计划时间: formatBusinessTime(scheduledTime),
          任务原因: reason,
          创建人: createdBy,
          当前状态: taskStatusDesc[TaskStatus.PENDING]
        }
      );
    } catch (e: any) {
      return errorResponse('ERR-RT-004', `创建任务失败：${e.message}`);
    }
  },

  getPendingTasks: (storeId?: string, itemId?: string): RecoveryTask[] => {
    let result = db.recoveryTasks.filter(t => t.status === TaskStatus.PENDING);
    if (storeId) result = result.filter(t => t.storeId === storeId);
    if (itemId) result = result.filter(t => t.itemId === itemId);
    return result.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  },

  getAllTasks: (storeId?: string, status?: TaskStatus): RecoveryTask[] => {
    let result = [...db.recoveryTasks];
    if (storeId) result = result.filter(t => t.storeId === storeId);
    if (status) result = result.filter(t => t.status === status);
    return result.sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime));
  },

  executeTask: (taskId: string): BusinessResponse => {
    const task = db.recoveryTasks.find(t => t.id === taskId);
    if (!task) {
      return errorResponse('ERR-RT-005', '任务不存在');
    }
    if (task.status !== TaskStatus.PENDING) {
      return errorResponse('WARN-RT-002', `任务状态为「${taskStatusDesc[task.status]}」，无法执行`);
    }

    const results: { channelId: string; success: boolean; message: string }[] = [];
    let successCount = 0;

    task.status = TaskStatus.RUNNING;
    task.executedAt = now();
    db.save();

    for (const chId of task.channelIds) {
      const isStockout = inventoryService.checkStockout(task.storeId, task.itemId);
      if (isStockout) {
        results.push({
          channelId: chId,
          success: false,
          message: '库存仍不足，无法恢复上架'
        });
        continue;
      }

      const result = channelStatusService.changeStatus(
        task.storeId, task.itemId, chId,
        StatusType.ONLINE,
        null,
        SourceType.AUTO,
        '系统-恢复任务',
        `恢复任务${taskId}自动执行`,
        taskId
      );

      results.push({
        channelId: chId,
        success: result.success,
        message: result.message
      });
      if (result.success) successCount++;
    }

    const finalStatus = successCount === task.channelIds.length ? TaskStatus.COMPLETED : 
                        successCount > 0 ? TaskStatus.COMPLETED : TaskStatus.FAILED;
    task.status = finalStatus;
    db.save();

    return successResponse(
      `恢复任务执行完成：${successCount}/${task.channelIds.length}个渠道成功`,
      {
        任务ID: taskId,
        最终状态: taskStatusDesc[finalStatus],
        成功渠道: successCount,
        总渠道数: task.channelIds.length,
        执行时间: formatBusinessTime(now()),
        渠道详情: results
      }
    );
  },

  cancelTask: (taskId: string, operator: string): BusinessResponse => {
    const task = db.recoveryTasks.find(t => t.id === taskId);
    if (!task) {
      return errorResponse('ERR-RT-005', '任务不存在');
    }
    if (task.status !== TaskStatus.PENDING) {
      return errorResponse('WARN-RT-003', `任务状态为「${taskStatusDesc[task.status]}」，无法取消`);
    }

    task.status = TaskStatus.CANCELLED;
    db.save();

    return successResponse(
      `恢复任务已取消`,
      {
        任务ID: taskId,
        取消人: operator,
        取消时间: formatBusinessTime(now())
      }
    );
  },

  executeDueTasks: (): BusinessResponse => {
    const nowStr = now();
    const dueTasks = db.recoveryTasks.filter(
      t => t.status === TaskStatus.PENDING && t.scheduledTime <= nowStr
    );

    if (dueTasks.length === 0) {
      return successResponse('当前无到期的恢复任务');
    }

    const results: { taskId: string; result: BusinessResponse }[] = [];
    for (const task of dueTasks) {
      results.push({
        taskId: task.id,
        result: recoveryTaskService.executeTask(task.id)
      });
    }

    return successResponse(
      `批量执行完成，共处理${dueTasks.length}个到期任务`,
      { 任务结果: results }
    );
  }
};

export default recoveryTaskService;
