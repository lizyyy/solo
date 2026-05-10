import db from '../database';
import { ReconciliationJob, TaskStatus, StatusType, OfflineReason, SourceType, BusinessResponse } from '../types';
import { generateId, now, successResponse, errorResponse, formatBusinessTime, taskStatusDesc, statusDesc } from '../utils/business';
import channelStatusService from './channelStatusService';
import inventoryService from './inventoryService';
import historyService from './historyService';

interface InconsistentItem {
  storeId: string;
  itemId: string;
  channelId: string;
  currentStatus: StatusType;
  expectedStatus: StatusType;
  reason: string;
  autoFixed: boolean;
}

export const reconciliationService = {
  runReconciliation: (
    storeId?: string,
    channelId?: string,
    autoFix: boolean = false,
    operator: string = '系统-对账任务'
  ): BusinessResponse => {
    const jobId = generateId('rec');
    const startTime = now();

    let statuses = [...db.channelStatuses];
    if (storeId) statuses = statuses.filter(s => s.storeId === storeId);
    if (channelId) statuses = statuses.filter(s => s.channelId === channelId);

    const inconsistencies: InconsistentItem[] = [];
    let fixedCount = 0;

    for (const status of statuses) {
      const inv = inventoryService.getInventory(status.storeId, status.itemId);
      const isStockout = inv ? inv.quantity <= inv.minThreshold : true;

      const expectedStatus = isStockout ? StatusType.OFFLINE : StatusType.ONLINE;
      const currentStatus = status.status;

      if (currentStatus !== expectedStatus) {
        const reason = isStockout 
          ? `库存不足(${inv?.quantity ?? 0}/${inv?.minThreshold ?? 0})应下架但${statusDesc[currentStatus]}`
          : `库存充足应上架但${statusDesc[currentStatus]}`;

        let autoFixed = false;
        if (autoFix) {
          const result = channelStatusService.changeStatus(
            status.storeId,
            status.itemId,
            status.channelId,
            expectedStatus,
            isStockout ? OfflineReason.OUT_OF_STOCK : null,
            SourceType.AUTO,
            '系统-对账修正',
            `对账发现不一致，自动修正为${statusDesc[expectedStatus]}`
          );
          autoFixed = result.success;
          if (autoFixed) fixedCount++;
        }

        inconsistencies.push({
          storeId: status.storeId,
          itemId: status.itemId,
          channelId: status.channelId,
          currentStatus,
          expectedStatus,
          reason,
          autoFixed
        });
      }
    }

    const details = {
      检查范围: {
        门店: storeId || '全部门店',
        渠道: channelId || '全部渠道',
        自动修复: autoFix ? '已启用' : '未启用'
      },
      不一致详情: inconsistencies.map(item => ({
        门店ID: item.storeId,
        商品ID: item.itemId,
        渠道ID: item.channelId,
        当前状态: statusDesc[item.currentStatus],
        期望状态: statusDesc[item.expectedStatus],
        不一致原因: item.reason,
        自动修复: item.autoFixed ? '已修复' : '未修复'
      }))
    };

    const job: ReconciliationJob = {
      id: jobId,
      executedAt: startTime,
      storeId: storeId || null,
      channelId: channelId || null,
      totalChecked: statuses.length,
      inconsistentCount: inconsistencies.length,
      fixedCount,
      details: JSON.stringify(details),
      status: TaskStatus.COMPLETED
    };
    db.addReconciliationJob(job);

    const inconsistentText = inconsistencies.length > 0 
      ? `发现${inconsistencies.length}处不一致` 
      : '未发现不一致';
    const fixText = autoFix ? `，自动修复${fixedCount}处` : '';

    return successResponse(
      `对账完成：共检查${statuses.length}个状态记录，${inconsistentText}${fixText}`,
      {
        任务ID: jobId,
        执行时间: formatBusinessTime(startTime),
        检查总数: statuses.length,
        不一致数: inconsistencies.length,
        自动修复数: fixedCount,
        详情: details
      }
    );
  },

  getJobHistory: (limit: number = 50): BusinessResponse => {
    const jobs = [...db.reconciliationJobs]
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
      .slice(0, limit);

    const formattedJobs = jobs.map(job => ({
      任务ID: job.id,
      执行时间: formatBusinessTime(job.executedAt),
      门店范围: job.storeId || '全部',
      渠道范围: job.channelId || '全部',
      检查总数: job.totalChecked,
      不一致数: job.inconsistentCount,
      修复数: job.fixedCount,
      状态: taskStatusDesc[job.status]
    }));

    return successResponse(
      `获取对账历史成功，共${formattedJobs.length}条记录`,
      formattedJobs
    );
  },

  getJobDetail: (jobId: string): BusinessResponse => {
    const job = db.reconciliationJobs.find(j => j.id === jobId);
    if (!job) {
      return errorResponse('ERR-REC-001', '对账任务不存在');
    }

    let details: any = {};
    try {
      details = JSON.parse(job.details);
    } catch (e) {
      details = { 原始详情: job.details };
    }

    return successResponse(
      `对账任务详情`,
      {
        任务ID: job.id,
        执行时间: formatBusinessTime(job.executedAt),
        门店范围: job.storeId || '全部',
        渠道范围: job.channelId || '全部',
        检查总数: job.totalChecked,
        不一致数: job.inconsistentCount,
        修复数: job.fixedCount,
        状态: taskStatusDesc[job.status],
        详情: details
      }
    );
  }
};

export default reconciliationService;
