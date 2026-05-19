import { db } from '../config/database';
import * as xlsx from 'xlsx';

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
    await db.read();
    
    const totalTasks = db.data.tasks.length;
    const successTasks = db.data.tasks.filter(t => t.status === 'success').length;
    const failedTasks = db.data.tasks.filter(t => t.status === 'failed' || t.status === 'rolled_back').length;
    const totalRecords = db.data.tasks.reduce((sum, t) => sum + t.successRecords, 0);
    const environments = db.data.environments.length;
    const datasets = db.data.datasets.length;
    const pendingReview = db.data.rollbackRecords.filter(r => r.status === 'pending').length;

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
    await db.read();
    
    const trend: TaskTrend[] = [];
    const trendMap = new Map<string, { total: number; success: number; failed: number }>();

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { total: 0, success: 0, failed: 0 });
    }

    db.data.tasks.forEach(task => {
      const dateStr = task.createdAt.split('T')[0];
      if (trendMap.has(dateStr)) {
        const day = trendMap.get(dateStr)!;
        day.total++;
        if (task.status === 'success') day.success++;
        if (task.status === 'failed' || task.status === 'rolled_back') day.failed++;
      }
    });

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  static async exportTaskReport(taskId: string): Promise<Buffer> {
    await db.read();
    
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const environment = db.data.environments.find(e => e.id === task.environmentId);
    const dataset = db.data.datasets.find(d => d.id === task.datasetId);

    const records = db.data.seedRecords.filter(r => r.taskId === taskId);
    const rollbacks = db.data.rollbackRecords.filter(r => r.taskId === taskId);

    const taskInfo = {
      '任务ID': task.id,
      '环境': environment?.name || 'N/A',
      '数据集': dataset?.name || 'N/A',
      '版本': dataset?.version || 'N/A',
      '状态': task.status,
      '重试次数': `${task.retryCount}/${task.maxRetries}`,
      '总记录数': task.totalRecords,
      '成功记录': task.successRecords,
      '失败记录': task.failedRecords,
      '创建时间': task.createdAt,
      '完成时间': task.completedAt || 'N/A',
      '错误信息': task.errorMessage || 'N/A',
    };

    const recordsData = records.map(r => ({
      '记录ID': r.recordId,
      '状态': r.status,
      '导入时间': r.importedAt || 'N/A',
      '回滚时间': r.rolledBackAt || 'N/A',
      '错误信息': r.errorMessage || 'N/A',
    }));

    const rollbacksData = rollbacks.map(r => ({
      '回滚ID': r.id,
      '原因': r.reason,
      '状态': r.status,
      '回滚记录数': r.rolledBackRecords,
      '评审人': r.reviewedBy || 'N/A',
      '评审意见': r.reviewComment || 'N/A',
      '创建时间': r.createdAt,
    }));

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet([taskInfo]), '任务概览');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(recordsData), '导入记录');
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rollbacksData), '回滚记录');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static async recalculateDatasetStats(datasetId: string): Promise<void> {
    await db.read();
    
    const tasks = db.data.tasks.filter(t => t.datasetId === datasetId);
    const dataset = db.data.datasets.find(d => d.id === datasetId);
    
    if (dataset) {
      const totalRecords = tasks.reduce((sum, t) => sum + t.successRecords, 0);
      dataset.recordCount = totalRecords;
      dataset.updatedAt = new Date().toISOString();
      await db.write();
    }
  }
}
