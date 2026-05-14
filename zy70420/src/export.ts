import { dataStore } from './store';
import { CancellationResult, LiveSample, Batch, ManualAdjustment, SampleStatus } from './types';

export type ExportFormat = 'json' | 'markdown' | 'csv';

export class ExportService {
  exportCancellationResult(result: CancellationResult, format: ExportFormat): string {
    const batch = dataStore.getBatchById(result.batchId);
    const adjustments = dataStore.getAdjustmentsByBatch(result.batchId);

    switch (format) {
      case 'json':
        return this.exportToJson(result, batch, adjustments);
      case 'markdown':
        return this.exportToMarkdown(result, batch, adjustments);
      case 'csv':
        return this.exportToCsv(result, batch, adjustments);
      default:
        return this.exportToJson(result, batch, adjustments);
    }
  }

  private exportToJson(result: CancellationResult, batch?: Batch, adjustments: ManualAdjustment[] = []): string {
    return JSON.stringify({
      exportInfo: {
        exportedAt: new Date().toISOString(),
        format: 'JSON'
      },
      batch: batch ? {
        batchId: batch.id,
        batchName: batch.name,
        createdAt: batch.createdAt,
        createdBy: batch.createdBy
      } : null,
      cancellation: {
        success: result.success,
        totalProcessed: result.totalProcessed,
        successfullyCancelled: result.successfullyCancelled,
        failedCount: result.failedCount,
        completedAt: result.completedAt
      },
      failedSamples: result.failedSamples.map(sample => ({
        ...sample,
        processingAdvice: this.getProcessingAdvice(sample)
      })),
      manualAdjustments: adjustments.map(adj => ({
        adjustmentId: adj.id,
        sampleId: adj.sampleId,
        adjustedBy: adj.adjustedBy,
        adjustedAt: adj.adjustedAt,
        oldStatus: adj.oldStatus,
        newStatus: adj.newStatus,
        reason: adj.reason,
        remarks: adj.remarks,
        sourceReference: `批次号: ${adj.batchId}`
      }))
    }, null, 2);
  }

  private exportToMarkdown(result: CancellationResult, batch?: Batch, adjustments: ManualAdjustment[] = []): string {
    const now = new Date().toISOString();
    
    let md = `# 批量取消任务报告\n\n`;
    md += `> 导出时间: ${now}\n`;
    md += `> 批次号: ${result.batchId}\n`;
    if (batch) {
      md += `> 批次名称: ${batch.name}\n`;
    }
    md += `\n---\n\n`;

    md += `## 执行概要\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 执行结果 | ${result.success ? '✅ 全部成功' : '⚠️ 部分失败'} |\n`;
    md += `| 处理总数 | ${result.totalProcessed} |\n`;
    md += `| 成功取消 | ${result.successfullyCancelled} |\n`;
    md += `| 失败数量 | ${result.failedCount} |\n`;
    md += `| 完成时间 | ${result.completedAt} |\n\n`;

    if (result.failedSamples.length > 0) {
      md += `## 失败样品详情（待复核）\n\n`;
      md += `| 样品ID | 商品名称 | 来源 | 当前状态 | 错误原因 | 处理建议 |\n`;
      md += `|--------|----------|------|----------|----------|----------|\n`;
      result.failedSamples.forEach(sample => {
        md += `| ${sample.sampleId} | ${sample.productName} | ${sample.source} | ${sample.status} | ${sample.error} | ${this.getProcessingAdvice(sample)} |\n`;
      });
      md += `\n`;
    }

    if (adjustments.length > 0) {
      md += `## 人工修正记录\n\n`;
      adjustments.forEach((adj, idx) => {
        md += `### 修正记录 ${idx + 1}\n\n`;
        md += `- **修正ID**: ${adj.id}\n`;
        md += `- **关联样品**: ${adj.sampleId}\n`;
        md += `- **来源批次**: ${adj.batchId}\n`;
        md += `- **操作人**: ${adj.adjustedBy}\n`;
        md += `- **操作时间**: ${adj.adjustedAt}\n`;
        md += `- **状态变更**: ${adj.oldStatus} → ${adj.newStatus}\n`;
        md += `- **处理依据**: ${adj.reason}\n`;
        md += `- **详细备注**: ${adj.remarks}\n\n`;
      });
    }

    md += `---\n\n`;
    md += `> 此报告由系统自动生成，失败样品请运营同事复核处理。\n`;

    return md;
  }

  private exportToCsv(result: CancellationResult, batch?: Batch, adjustments: ManualAdjustment[] = []): string {
    let csv = `类型,批次号,批次名称,样品ID,商品名称,来源,原状态,结果,错误信息,操作人,操作时间,备注\n`;

    result.failedSamples.forEach(sample => {
      csv += `失败样品,${result.batchId},${batch?.name || ''},${sample.sampleId},${sample.productName},${sample.source},${sample.status},失败,${sample.error},,,\n`;
    });

    adjustments.forEach(adj => {
      csv += `人工修正,${adj.batchId},${batch?.name || ''},${adj.sampleId},,人工,${adj.oldStatus},${adj.newStatus},,${adj.adjustedBy},${adj.adjustedAt},${adj.remarks}\n`;
    });

    return csv;
  }

  private getProcessingAdvice(sample: any): string {
    if (sample.error.includes('来源混杂')) {
      return '请追溯样品真实来源，确认后可强制取消';
    }
    if (sample.error.includes('已完成')) {
      return '已完成样品不建议取消，如确需取消请联系数据团队';
    }
    if (sample.error.includes('人工修正')) {
      return '请联系原修正人确认是否可以取消';
    }
    return '请核实具体原因后处理';
  }

  exportReviewList(batchId: string, format: ExportFormat): string | null {
    const samples = dataStore.getSamplesByBatch(batchId);
    const batch = dataStore.getBatchById(batchId);
    const adjustments = dataStore.getAdjustmentsByBatch(batchId);

    const problemSamples = samples.filter(s => 
      s.source === 'mixed' || 
      s.status === SampleStatus.NEEDS_REVIEW ||
      s.status === SampleStatus.FAILED
    );

    if (problemSamples.length === 0 && adjustments.length === 0) {
      return null;
    }

    switch (format) {
      case 'json':
        return JSON.stringify({
          exportInfo: { exportedAt: new Date().toISOString(), type: '复核清单' },
          batch: batch ? { id: batch.id, name: batch.name } : null,
          problemSamples: problemSamples.map(s => ({
            id: s.id,
            productName: s.productName,
            source: s.source,
            status: s.status,
            remarks: s.remarks,
            issue: this.getIssueDescription(s)
          })),
          manualAdjustments: adjustments.map(a => ({
            sampleId: a.sampleId,
            adjustedBy: a.adjustedBy,
            reason: a.reason,
            remarks: a.remarks,
            sourceReference: `批次号: ${a.batchId}`
          }))
        }, null, 2);
      
      case 'markdown':
        let md = `# 批次复核清单\n\n`;
        md += `> 批次: ${batchId}\n`;
        md += `> 导出时间: ${new Date().toISOString()}\n\n`;

        if (problemSamples.length > 0) {
          md += `## 问题样品\n\n`;
          md += `| 样品ID | 商品名称 | 来源 | 状态 | 问题描述 | 备注 |\n`;
          md += `|--------|----------|------|------|----------|------|\n`;
          problemSamples.forEach(s => {
            md += `| ${s.id} | ${s.productName} | ${s.source} | ${s.status} | ${this.getIssueDescription(s)} | ${s.remarks || '-'} |\n`;
          });
          md += `\n`;
        }

        if (adjustments.length > 0) {
          md += `## 人工修正记录\n\n`;
          adjustments.forEach(a => {
            md += `### 样品 ${a.sampleId}\n`;
            md += `- **操作人**: ${a.adjustedBy}\n`;
            md += `- **处理依据**: ${a.reason}\n`;
            md += `- **来源批次**: ${a.batchId}\n`;
            md += `- **备注**: ${a.remarks}\n\n`;
          });
        }

        return md;

      default:
        return this.exportReviewList(batchId, 'json');
    }
  }

  private getIssueDescription(sample: LiveSample): string {
    if (sample.source === 'mixed') {
      return '样本来源混杂，系统无法准确追溯';
    }
    if (sample.status === SampleStatus.NEEDS_REVIEW) {
      return '需要人工复核';
    }
    if (sample.status === SampleStatus.FAILED) {
      return '处理失败';
    }
    return '未知问题';
  }
}

export const exportService = new ExportService();