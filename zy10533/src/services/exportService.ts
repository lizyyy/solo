import { createObjectCsvWriter } from 'csv-writer';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { QueueAdjustment, AffectedTask, FailureRecord } from '../types';
import { QueueAdjustmentService } from './queueAdjustmentService';

const EXPORT_DIR = join(process.cwd(), 'exports');

export const ExportService = {
  async exportAdjustmentToCSV(adjustmentId: string): Promise<string> {
    const adjustment = await QueueAdjustmentService.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      throw new Error('调整记录不存在');
    }

    const tasks = await QueueAdjustmentService.getAffectedTasks(adjustmentId);
    const failures = await QueueAdjustmentService.getFailureRecords(adjustmentId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `adjustment-${adjustmentId}-${timestamp}.csv`;
    const filepath = join(EXPORT_DIR, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'adjustmentId', title: '调整ID' },
        { id: 'queueName', title: '队列名称' },
        { id: 'originalPriority', title: '原优先级' },
        { id: 'targetPriority', title: '目标优先级' },
        { id: 'reason', title: '调整原因' },
        { id: 'status', title: '状态' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'taskId', title: '影响任务ID' },
        { id: 'taskType', title: '任务类型' },
        { id: 'affectedAt', title: '影响时间' },
        { id: 'failureCount', title: '异常次数' }
      ]
    });

    const records = tasks.map(task => ({
      adjustmentId: adjustment.id,
      queueName: adjustment.queueName,
      originalPriority: adjustment.originalPriority,
      targetPriority: adjustment.targetPriority,
      reason: adjustment.reason,
      status: adjustment.status,
      createdAt: adjustment.createdAt.toISOString(),
      taskId: task.taskId,
      taskType: task.taskType,
      affectedAt: task.affectedAt.toISOString(),
      failureCount: failures.length
    }));

    if (records.length === 0) {
      records.push({
        adjustmentId: adjustment.id,
        queueName: adjustment.queueName,
        originalPriority: adjustment.originalPriority,
        targetPriority: adjustment.targetPriority,
        reason: adjustment.reason,
        status: adjustment.status,
        createdAt: adjustment.createdAt.toISOString(),
        taskId: '',
        taskType: '',
        affectedAt: '',
        failureCount: failures.length
      });
    }

    await csvWriter.writeRecords(records);
    return filepath;
  },

  async exportFailureReport(adjustmentId: string): Promise<string> {
    const adjustment = await QueueAdjustmentService.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      throw new Error('调整记录不存在');
    }

    const failures = await QueueAdjustmentService.getFailureRecords(adjustmentId);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `failure-report-${adjustmentId}-${timestamp}.json`;
    const filepath = join(EXPORT_DIR, filename);

    const report = {
      adjustment: {
        id: adjustment.id,
        queueName: adjustment.queueName,
        status: adjustment.status,
        reason: adjustment.reason
      },
      failureCount: failures.length,
      failures: failures.map(f => ({
        id: f.id,
        operation: f.operation,
        errorMessage: f.errorMessage,
        processingBasis: f.processingBasis,
        originalInput: f.originalInput,
        createdAt: f.createdAt.toISOString(),
        resolved: !!f.resolvedAt,
        finalConclusion: f.finalConclusion
      })),
      generatedAt: new Date().toISOString()
    };

    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(filepath);
      stream.write(JSON.stringify(report, null, 2));
      stream.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return filepath;
  },

  generateTextSummary(adjustment: QueueAdjustment, tasks: AffectedTask[], failures: FailureRecord[]): string {
    const taskTypeStats: Record<string, number> = {};
    tasks.forEach(t => {
      taskTypeStats[t.taskType] = (taskTypeStats[t.taskType] || 0) + 1;
    });

    return `
==== 队列优先级调整报告 ====

【基本信息】
调整ID: ${adjustment.id}
队列名称: ${adjustment.queueName}
调整原因: ${adjustment.reason}
创建人: ${adjustment.createdBy}
创建时间: ${adjustment.createdAt.toLocaleString()}

【优先级变更】
原优先级: ${adjustment.originalPriority}
目标优先级: ${adjustment.targetPriority}
调整幅度: ${adjustment.targetPriority - adjustment.originalPriority > 0 ? '提升' : '降低'} ${Math.abs(adjustment.targetPriority - adjustment.originalPriority)} 级

【状态追踪】
当前状态: ${adjustment.status}
激活时间: ${adjustment.activatedAt?.toLocaleString() || '未激活'}
恢复时间: ${adjustment.restoredAt?.toLocaleString() || '未恢复'}
完成时间: ${adjustment.completedAt?.toLocaleString() || '未完成'}

【影响统计】
受影响任务总数: ${tasks.length}
按任务类型分布:
${Object.entries(taskTypeStats).map(([type, count]) => `  - ${type}: ${count} 个`).join('\n')}

【异常记录】
异常次数: ${failures.length}
${failures.length > 0 ? failures.map(f => `  - [${f.operation}] ${f.errorMessage} (${f.createdAt.toLocaleString()})`).join('\n') : '  无异常'}

【恢复条件】
${adjustment.recoveryCondition}

${adjustment.report ? `【最终报告】${adjustment.report.summary}` : ''}

============================
    `.trim();
  }
};
