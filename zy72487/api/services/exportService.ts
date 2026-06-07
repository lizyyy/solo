import * as XLSX from 'xlsx';
import type { AcceptanceRecord } from '../../shared/types.js';
import { dataStore } from '../data/unifiedStore.js';

export class ExportService {
  exportDetail(): {
    data: AcceptanceRecord[];
    workbook: XLSX.WorkBook;
  } {
    const records = dataStore.getUnifiedView();

    const flatData = records.map((r) => ({
      红线图编号: r.redLineNo,
      小区名称: r.communityName,
      小区旧名称: r.communityNameOld || '',
      状态: this.getStatusText(r.status),
      是否存在冲突: r.hasConflict ? '是' : '否',
      冲突状态: this.getConflictStatusText(r.conflictStatus),
      冲突处理意见: r.conflictResolution || '',
      是否存在小区新旧名: r.hasNameIssue ? '是' : '否',
      新旧名复核状态: this.getNameReviewStatusText(r.nameReviewStatus),
      红线图备注: r.redLineRemark,
      网格员巡查表: r.gridInspection,
      街道会看摘要: r.streetSummary,
      导入时间: r.importTime,
      复核时间: r.reviewTime || '',
      摘要更新时间: r.summaryTime || '',
      操作人: r.operator,
      参数版本: r.calculationMeta?.paramVersion || '',
      取舍理由: r.calculationMeta?.decisionReason || '',
      计算时间: r.calculationMeta?.calculationTime || '',
      算法: r.calculationMeta?.algorithm || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '验收明细');

    if (records.some((r) => r.conflictPoints && r.conflictPoints.length > 0)) {
      const conflictData = records.flatMap((r) =>
        (r.conflictPoints || []).map((cp) => ({
          红线图编号: r.redLineNo,
          小区名称: r.communityName,
          冲突字段: cp.field,
          红线图值: cp.redLineValue,
          网格员值: cp.gridValue,
          冲突描述: cp.description,
        }))
      );
      const conflictSheet = XLSX.utils.json_to_sheet(conflictData);
      XLSX.utils.book_append_sheet(workbook, conflictSheet, '冲突明细');
    }

    return { data: records, workbook };
  }

  exportSummary(): {
    data: Array<Record<string, string>>;
    workbook: XLSX.WorkBook;
  } {
    const records = dataStore.getUnifiedView();

    const summaryData = records.map((r) => ({
      红线图编号: r.redLineNo,
      小区名称: r.communityName + (r.communityNameOld ? `（原：${r.communityNameOld}）` : ''),
      验收状态: this.getStatusText(r.status),
      异常标记: this.getExceptionFlags(r),
      街道会看摘要: r.streetSummary || '（待更新）',
      最近更新: r.summaryTime || r.reviewTime || r.importTime,
    }));

    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '验收摘要');

    return { data: summaryData, workbook };
  }

  downloadWorkbook(workbook: XLSX.WorkBook, filename: string): Buffer {
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      pending_import: '待导入',
      pending_review: '待巡检员复核',
      pending_summary: '待更新摘要',
      completed: '已完成',
    };
    return map[status] || status;
  }

  private getConflictStatusText(status?: string): string {
    if (!status) return '无冲突';
    const map: Record<string, string> = {
      pending: '待处理',
      confirmed: '已确认',
      rejected: '已驳回',
    };
    return map[status] || status;
  }

  private getNameReviewStatusText(status?: string): string {
    if (!status) return '无问题';
    const map: Record<string, string> = {
      pending: '待复核',
      confirmed: '已确认',
    };
    return map[status] || status;
  }

  private getExceptionFlags(r: AcceptanceRecord): string {
    const flags: string[] = [];
    if (r.hasConflict && r.conflictStatus === 'pending') {
      flags.push('冲突待处理');
    }
    if (r.hasNameIssue && r.nameReviewStatus === 'pending') {
      flags.push('新旧名待确认');
    }
    return flags.length > 0 ? flags.join('、') : '正常';
  }
}

export const exportService = new ExportService();
