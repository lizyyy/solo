import { SeedTask, SeedRecord, Environment, DatasetVersion, RollbackRecord } from '../models';
import xlsx from 'xlsx';
import { TaskStatus } from '../models/SeedTask';

export interface DashboardStats {
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  successRate: number;
  totalRecords: number;
  environments: number;
  datasets: number;
  pendingReview: number;
}

export interface TaskTrend {
  date: string;
  total: number;
  success: number;
  failed: number;
}

export class ReportService {
  static async getDashboardStats(): Promise<DashboardStats> {
    const [tasks, environments, datasets, rollbacks] = await Promise.all([
      SeedTask.findAll(),
      Environment.count(),
      DatasetVersion.count(),
      RollbackRecord.count(),
    ]);

    const totalTasks = tasks.length;
    const successTasks = tasks.filter(t => t.status === TaskStatus.SUCCESS).length;
    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED || t.status === TaskStatus.ROLLED_BACK).length;
    const totalRecords = tasks.reduce((sum, t) => sum + t.successRecords, 0);
    const pendingReview = await RollbackRecord.count({ where: { status: 'pending' } });

    return {
      totalTasks,
      successTasks,
      failedTasks,
      successRate: totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0,
      totalRecords,
      environments,
      datasets,
      pendingReview,
    };
  }

  static async getTaskTrend(days: number = 7): Promise<TaskTrend[]> {
    const tasks = await SeedTask.findAll({
      order: [['createdAt', 'DESC']],
    });

    const trendMap = new Map<string, { total: number; success: number; failed: number }>();

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { total: 0, success: 0, failed: 0 });
    }

    tasks.forEach(task => {
      const dateStr = task.createdAt.toISOString().split('T')[0];
      if (trendMap.has(dateStr)) {
        const day = trendMap.get(dateStr)!;
        day.total++;
        if (task.status === TaskStatus.SUCCESS) day.success++;
        if (task.status === TaskStatus.FAILED || task.status === TaskStatus.ROLLED_BACK) day.failed++;
      }
    });

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  static async exportTaskReport(taskId: string): Promise<Buffer> {
    const task = await SeedTask.findByPk(taskId, {
      include: [Environment, DatasetVersion],
    });

    if (!task) throw new Error('Task not found');

    const records = await SeedRecord.findAll({ where: { taskId } });
    const rollbacks = await RollbackRecord.findAll({ where: { taskId } });

    const taskInfo = {
      '任务ID': task.id,
      '环境': (task as any).Environment?.name || 'N/A',
      '数据集版本': (task as any).DatasetVersion?.version || 'N/A',
      '状态': task.status,
      '重试次数': task.retryCount,
      '总记录数': task.totalRecords,
      '成功记录': task.successRecords,
      '失败记录': task.failedRecords,
      '创建时间': task.createdAt.toISOString(),
      '完成时间': task.completedAt?.toISOString() || 'N/A',
      '错误信息': task.errorMessage || 'N/A',
    };

    const recordsData = records.map(r => ({
      '记录ID': r.recordId,
      '状态': r.status,
      '导入时间': r.importedAt?.toISOString() || 'N/A',
      '回滚时间': r.rolledBackAt?.toISOString() || 'N/A',
      '错误信息': r.errorMessage || 'N/A',
    }));

    const rollbacksData = rollbacks.map(r => ({
      '回滚ID': r.id,
      '原因': r.reason,
      '状态': r.status,
      '回滚记录数': r.rolledBackRecords,
      '评审人': r.reviewedBy || 'N/A',
      '评审意见': r.reviewComment || 'N/A',
      '创建时间': r.createdAt.toISOString(),
    }));

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet([taskInfo]), '任务概览');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(recordsData), '导入记录');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rollbacksData), '回滚记录');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static async recalculateDatasetStats(datasetVersionId: string): Promise<void> {
    const tasks = await SeedTask.findAll({ where: { datasetVersionId } });
    
    const totalRecords = tasks.reduce((sum, t) => sum + t.successRecords, 0);
    const totalTasks = tasks.length;
    const successTasks = tasks.filter(t => t.status === TaskStatus.SUCCESS).length;

    await DatasetVersion.update(
      {
        recordCount: totalRecords,
        metadata: { totalTasks, successTasks, successRate: totalTasks > 0 ? successTasks / totalTasks : 0 },
      },
      { where: { id: datasetVersionId } }
    );
  }
}
