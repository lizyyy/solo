import unifiedDataService from './unifiedDataService';
import systemStore from '../store/systemStore';
import { createAuditLog } from '../utils/auditTrail';
import { AuditAction, UnifiedViewRecord } from '../types';

interface ExportRow {
  submissionId: string;
  studentId: string;
  studentName: string;
  displayStatus: string;
  statusText: string;
  totalScore: number;
  originalTotalScore?: number;
  scoreDelta?: number;
  isRecalculated: boolean;
  needsReview: boolean;
  reviewStatus: string;
  exportReady: boolean;
  lastOperator: string;
  lastOperatedAt: string;
  originalStatement?: string;
  correctedStatement?: string;
  processingReason?: string;
  nextStepContact?: string;
  versionCount: number;
  [key: string]: any;
}

export class DataExportService {
  public exportScoringResults(
    operator: string,
    options: { includePending?: boolean; format?: 'csv' | 'json' } = {}
  ): {
    csvContent: string;
    jsonContent: string;
    data: ExportRow[];
    unifiedRecords: UnifiedViewRecord[];
  } {
    const unifiedRecords = options.includePending
      ? unifiedDataService.getUnifiedList()
      : unifiedDataService.getUnifiedList().filter(r => r.exportReady);

    const data = this.buildExportData(unifiedRecords);
    const csvContent = this.generateCsv(data);
    const jsonContent = JSON.stringify(data, null, 2);

    createAuditLog(
      'result',
      'export-batch',
      AuditAction.EXPORT,
      operator,
      `导出 ${data.length} 条记录${options.includePending ? '(含待复核)' : ''}`,
      []
    );

    return { csvContent, jsonContent, data, unifiedRecords };
  }

  private buildExportData(records: UnifiedViewRecord[]): ExportRow[] {
    const allCriteria = new Map<string, { id: string; name: string; maxScore: number }>();
    records.forEach(r => {
      r.scoreDetails.forEach(d => {
        if (!allCriteria.has(d.criterionId)) {
          allCriteria.set(d.criterionId, {
            id: d.criterionId,
            name: d.criterionName,
            maxScore: d.maxScore
          });
        }
      });
    });

    return records.map(rec => {
      const row: ExportRow = {
        submissionId: rec.submissionId,
        studentId: rec.studentId,
        studentName: rec.studentName,
        displayStatus: rec.displayStatus,
        statusText: rec.statusText,
        totalScore: rec.totalScore,
        originalTotalScore: rec.originalTotalScore,
        scoreDelta:
          rec.originalTotalScore !== undefined
            ? Math.round((rec.totalScore - rec.originalTotalScore) * 100) / 100
            : undefined,
        isRecalculated: rec.isRecalculated,
        needsReview: rec.needsReview,
        reviewStatus: rec.reviewStatus,
        exportReady: rec.exportReady,
        lastOperator: rec.auditInfo.lastOperator,
        lastOperatedAt: rec.auditInfo.lastOperatedAt.toISOString(),
        originalStatement: rec.auditInfo.originalStatement,
        correctedStatement: rec.auditInfo.correctedStatement,
        processingReason: rec.auditInfo.processingReason,
        nextStepContact: rec.auditInfo.nextStepContact,
        versionCount: rec.auditInfo.allVersions.length
      };

      allCriteria.forEach(criterion => {
        const detail = rec.scoreDetails.find(d => d.criterionId === criterion.id);
        row[`${criterion.id}_rawScore`] = detail?.score ?? 0;
        row[`${criterion.id}_weightedScore`] = detail?.weightedScore ?? 0;
        row[`${criterion.id}_originalScore`] = detail?.originalScore;
        row[`${criterion.id}_maxScore`] = detail?.maxScore ?? criterion.maxScore;
        row[`${criterion.id}_notes`] = detail?.notes || '';
        row[`${criterion.id}_correctionNote`] = detail?.correctionNote || '';
      });

      const versionSummary = rec.auditInfo.allVersions
        .map(
          v =>
            `[v${v.version}] ${v.operatedAt.toISOString()} - ${v.operator}: ${v.summary}${v.scoreSnapshot !== undefined ? ` (${v.scoreSnapshot}分)` : ''}`
        )
        .join(' | ');
      row['history_trace'] = versionSummary;

      return row;
    });
  }

  private generateCsv(data: ExportRow[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');
    const dataRows = data.map(row =>
      headers.map(h => this.escapeCsvValue(row[h])).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  }

  public getDisplayData(submissionId?: string): ReturnType<typeof unifiedDataService.getUnifiedList> {
    if (submissionId) {
      const rec = unifiedDataService.getUnifiedRecord(submissionId);
      return rec ? [rec] : [];
    }
    return unifiedDataService.getUnifiedList();
  }

  public getApiResponse(submissionId?: string): any {
    if (submissionId) {
      const record = unifiedDataService.getUnifiedRecord(submissionId);
      return {
        ok: !!record,
        submissionId,
        data: record,
        _source: 'canonical_unified_view'
      };
    }
    const list = unifiedDataService.getUnifiedList();
    const summary = unifiedDataService.getSummary();
    return {
      ok: true,
      summary,
      list,
      _source: 'canonical_unified_view'
    };
  }

  public verifyDataConsistency(submissionId: string): {
    consistent: boolean;
    differences: string[];
    exportRow?: ExportRow;
    apiRow?: any;
    displayRow?: UnifiedViewRecord | null;
  } {
    const differences: string[] = [];

    const displayRow = unifiedDataService.getUnifiedRecord(submissionId);
    const apiRow = this.getApiResponse(submissionId);
    const exportResult = this.exportScoringResults('system-check', {
      includePending: true
    });
    const exportRow = exportResult.data.find(d => d.submissionId === submissionId);

    if (displayRow && exportRow) {
      if (displayRow.totalScore !== exportRow.totalScore) {
        differences.push(
          `导出总分(${exportRow.totalScore})与展示总分(${displayRow.totalScore})不一致`
        );
      }
      if (displayRow.studentId !== exportRow.studentId) {
        differences.push('导出与展示studentId不一致');
      }
      if (displayRow.studentName !== exportRow.studentName) {
        differences.push('导出与展示studentName不一致');
      }
      if (displayRow.reviewStatus !== exportRow.reviewStatus) {
        differences.push('导出与展示reviewStatus不一致');
      }
    }

    if (displayRow && apiRow?.data) {
      if (displayRow.totalScore !== apiRow.data.totalScore) {
        differences.push(
          `API总分(${apiRow.data.totalScore})与展示总分(${displayRow.totalScore})不一致`
        );
      }
      if (displayRow.studentId !== apiRow.data.studentId) {
        differences.push('API与展示studentId不一致');
      }
      if (displayRow.statusText !== apiRow.data.statusText) {
        differences.push('API与展示statusText不一致');
      }
    }

    return {
      consistent: differences.length === 0,
      differences,
      exportRow,
      apiRow: apiRow?.data,
      displayRow
    };
  }

  public generateReport(operator: string): string {
    const summary = unifiedDataService.getSummary();
    const consistency = unifiedDataService.verifyAllConsistency();
    const pendingConflicts = systemStore.getPendingConflicts();

    const lines: string[] = [];
    lines.push('========================================');
    lines.push('   网络流容量分配 - 数据一致性报告');
    lines.push('========================================');
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push(`操作人: ${operator}`);
    lines.push('');
    lines.push('【数据概览】');
    lines.push(`  总记录数: ${summary.total}`);
    lines.push(`  正常记录: ${summary.normal}`);
    lines.push(`  待复核: ${summary.pendingReview}`);
    lines.push(`  已修正: ${summary.corrected}`);
    lines.push(`  已重算: ${summary.recalculated}`);
    lines.push(`  可导出数: ${summary.exportReadyCount}`);
    lines.push(`  平均分: ${summary.averageScore}`);
    lines.push(`  待处理冲突: ${summary.pendingConflictCount}`);
    lines.push('');
    lines.push('【一致性检查】');
    if (consistency.length === 0) {
      lines.push('  ✓ 所有记录内部字段一致');
    } else {
      lines.push(`  ✗ 发现 ${consistency.length} 条记录存在问题:`);
      consistency.forEach(c => {
        lines.push(`    - ${c.studentName}(${c.submissionId}):`);
        c.issues.forEach(i => lines.push(`      * ${i}`));
      });
    }
    lines.push('');
    lines.push('【待处理冲突清单】');
    if (pendingConflicts.length === 0) {
      lines.push('  ✓ 无待处理冲突');
    } else {
      pendingConflicts.forEach(c => {
        lines.push(`  - [${c.type}] ${c.title}`);
        lines.push(`    原始: ${c.originalStatement.substring(0, 60)}...`);
        lines.push(`    下一步: ${c.nextStepContact || '未指定'}`);
      });
    }
    lines.push('');
    lines.push('========================================');

    const report = lines.join('\n');
    createAuditLog(
      'result',
      'report',
      AuditAction.EXPORT,
      operator,
      `生成数据一致性报告，共${consistency.length}项问题`,
      []
    );
    return report;
  }
}

export default new DataExportService();
