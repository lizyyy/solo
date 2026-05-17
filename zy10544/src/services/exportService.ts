import { createObjectCsvStringifier } from 'csv-writer';
import { ReleaseReport, ExceptionDetail, ActivityStockLock } from '../types';

export class ExportService {
  generateReadableReport(report: ReleaseReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('促销活动库存释放报告');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`【基本信息】`);
    lines.push(`  报告编号: ${report.reportId}`);
    lines.push(`  活动编号: ${report.activityId}`);
    lines.push(`  生成时间: ${this.formatDate(report.generatedAt)}`);
    lines.push(`  操作人: ${report.generatedBy || '系统'}`);
    lines.push('');

    lines.push(`【汇总统计】`);
    lines.push(`  涉及 SKU 总数: ${report.totalSkus} 个`);
    lines.push(`  总锁定库存数量: ${report.totalLockedQuantity} 件`);
    lines.push(`  总已释放库存数量: ${report.totalReleasedQuantity} 件`);
    lines.push(`  释放成功率: ${this.calculatePercentage(report.successCount, report.totalSkus)}%`);
    lines.push('');
    lines.push(`  状态分布:`);
    lines.push(`    - 成功释放: ${report.successCount} 个 SKU`);
    lines.push(`    - 释放失败: ${report.failedCount} 个 SKU`);
    lines.push(`    - 待处理: ${report.pendingCount} 个 SKU`);
    lines.push('');

    lines.push(`【SKU 明细列表】`);
    lines.push('-'.repeat(60));

    for (const detail of report.details) {
      lines.push('');
      lines.push(`SKU: ${detail.sku}${detail.skuName ? ` (${detail.skuName})` : ''}`);
      lines.push(`  锁定数量: ${detail.lockQuantity} 件`);
      lines.push(`  已释放数量: ${detail.releasedQuantity} 件`);
      lines.push(`  释放进度: ${this.calculatePercentage(detail.releasedQuantity, detail.lockQuantity)}%`);
      lines.push(`  当前状态: ${detail.status}`);
      if (detail.lastReleaseTime) {
        lines.push(`  最后操作时间: ${this.formatDate(detail.lastReleaseTime)}`);
      }
      if (detail.exceptionMessage) {
        lines.push(`  异常信息: ${detail.exceptionMessage}`);
      }
    }

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('报告结束');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  generateCsvReport(report: ReleaseReport): string {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'sku', title: 'SKU编码' },
        { id: 'skuName', title: '商品名称' },
        { id: 'lockQuantity', title: '锁定数量(件)' },
        { id: 'releasedQuantity', title: '已释放数量(件)' },
        { id: 'releaseProgress', title: '释放进度(%)' },
        { id: 'status', title: '当前状态' },
        { id: 'lastReleaseTime', title: '最后操作时间' },
        { id: 'exceptionMessage', title: '异常信息' },
      ],
    });

    const records = report.details.map((d) => ({
      sku: d.sku,
      skuName: d.skuName || '',
      lockQuantity: d.lockQuantity,
      releasedQuantity: d.releasedQuantity,
      releaseProgress: this.calculatePercentage(d.releasedQuantity, d.lockQuantity),
      status: d.status,
      lastReleaseTime: d.lastReleaseTime ? this.formatDate(d.lastReleaseTime) : '',
      exceptionMessage: d.exceptionMessage || '',
    }));

    const headerRow = '\ufeff' + csvStringifier.getHeaderString();
    const dataRows = csvStringifier.stringifyRecords(records);

    return headerRow + dataRows;
  }

  generateExceptionList(exceptions: ExceptionDetail[]): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push('异常明细清单');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`总计异常数: ${exceptions.length} 条`);
    lines.push('');

    for (let i = 0; i < exceptions.length; i++) {
      const ex = exceptions[i];
      lines.push(`【异常 ${i + 1}】`);
      lines.push(`  异常ID: ${ex.id}`);
      lines.push(`  活动编号: ${ex.activityId}`);
      lines.push(`  关联SKU: ${ex.sku || '无'}`);
      lines.push(`  异常类型: ${this.getExceptionTypeDescription(ex.exceptionType)}`);
      lines.push(`  错误信息: ${ex.errorMessage}`);
      lines.push(`  处理依据: ${ex.processingBasis}`);
      lines.push(`  发生时间: ${this.formatDate(ex.createdAt)}`);
      lines.push(`  是否已解决: ${ex.resolved ? '是' : '否'}`);
      if (ex.resolved) {
        lines.push(`  解决时间: ${this.formatDate(ex.resolvedAt!)}`);
        lines.push(`  解决人: ${ex.resolvedBy}`);
        lines.push(`  解决方案: ${ex.resolution}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  generateLockList(locks: ActivityStockLock[]): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push('库存锁定清单');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`总计记录数: ${locks.length} 条`);
    lines.push('');

    for (let i = 0; i < locks.length; i++) {
      const lock = locks[i];
      lines.push(`【记录 ${i + 1}】`);
      lines.push(`  锁定ID: ${lock.id}`);
      lines.push(`  活动编号: ${lock.activityId}`);
      lines.push(`  SKU: ${lock.sku}${lock.skuName ? ` (${lock.skuName})` : ''}`);
      lines.push(`  锁定数量: ${lock.lockQuantity} 件`);
      lines.push(`  已释放数量: ${lock.releasedQuantity} 件`);
      lines.push(`  释放进度: ${this.calculatePercentage(lock.releasedQuantity, lock.lockQuantity)}%`);
      lines.push(`  当前状态: ${this.getStatusDescription(lock.status)}`);
      lines.push(`  释放条件: ${this.getReleaseConditionDescription(lock.releaseCondition)}`);
      lines.push(`  锁定时间: ${this.formatDate(lock.lockTime)}`);
      if (lock.expectedReleaseTime) {
        lines.push(`  预计释放时间: ${this.formatDate(lock.expectedReleaseTime)}`);
      }
      if (lock.operator) {
        lines.push(`  操作人: ${lock.operator}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }

  private getExceptionTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      SKU_NOT_FOUND: 'SKU不存在',
      INSUFFICIENT_STOCK: '库存不足',
      DUPLICATE_RELEASE: '重复释放',
      INVALID_STATUS: '状态无效',
      SYSTEM_ERROR: '系统错误',
    };
    return descriptions[type] || type;
  }

  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      LOCKED: '已锁定',
      RELEASING: '释放中',
      PARTIALLY_RELEASED: '部分释放',
      RELEASED: '已释放',
      FAILED: '失败',
    };
    return descriptions[status] || status;
  }

  private getReleaseConditionDescription(condition: string): string {
    const descriptions: Record<string, string> = {
      ACTIVITY_CANCEL: '活动取消',
      ACTIVITY_END: '活动正常结束',
      MANUAL_TRIGGER: '人工触发',
      TIMEOUT: '超时自动释放',
    };
    return descriptions[condition] || condition;
  }
}

export const exportService = new ExportService();
