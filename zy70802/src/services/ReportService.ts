import { Parser } from 'json2csv';
import { DataStore } from '../store/DataStore';
import { ReconciliationEngine } from './ReconciliationEngine';
import { ReconciliationResult, DiscrepancyType } from '../types';
import dayjs from 'dayjs';

export class ReportService {
  private dataStore: DataStore;
  private engine: ReconciliationEngine;

  constructor() {
    this.dataStore = DataStore.getInstance();
    this.engine = new ReconciliationEngine();
  }

  generateReconciliationReportCSV(): string {
    const results = this.dataStore.getAllReconciliations();
    const rows = results.map(r => this.flattenReconciliationResult(r));

    const parser = new Parser({
      fields: [
        '对账记录ID',
        '危急值ID',
        '患者ID',
        '患者姓名',
        '科室',
        '病区',
        '检验项目',
        '检验结果',
        '危急值优先级',
        '报告时间',
        '短信发送时间',
        '回告记录ID',
        '回告时间',
        '回告医生',
        '回告号码',
        '确认时间',
        '通话结果',
        '对账状态',
        '差异类型',
        '差异数量',
        '高严重性差异',
        '中严重性差异',
        '低严重性差异',
        '对账时间',
        '复核时间',
        '复核人',
        '复核备注',
      ],
    });

    return parser.parse(rows);
  }

  private flattenReconciliationResult(result: ReconciliationResult): Record<string, any> {
    const cv = this.dataStore.getCriticalValue(result.criticalValueId);
    const cb = result.callbackId ? this.dataStore.getCallback(result.callbackId) : undefined;

    const highSeverity = result.discrepancies.filter(d => d.severity === 'high').length;
    const mediumSeverity = result.discrepancies.filter(d => d.severity === 'medium').length;
    const lowSeverity = result.discrepancies.filter(d => d.severity === 'low').length;

    return {
      '对账记录ID': result.id,
      '危急值ID': result.criticalValueId,
      '患者ID': cv?.patientId || '',
      '患者姓名': cv?.patientName || '',
      '科室': cv?.department || '',
      '病区': cv?.ward || '',
      '检验项目': cv?.testItem || '',
      '检验结果': cv?.testResult || '',
      '危急值优先级': cv?.priority || '',
      '报告时间': cv?.reportedAt ? dayjs(cv.reportedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '短信发送时间': cv?.smsSentAt ? dayjs(cv.smsSentAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '回告记录ID': result.callbackId || '',
      '回告时间': cb?.calledAt ? dayjs(cb.calledAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '回告医生': cb?.doctorName || '',
      '回告号码': cb?.calledTo || '',
      '确认时间': cb?.confirmedAt ? dayjs(cb.confirmedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '通话结果': cb?.callResult || '',
      '对账状态': result.status === 'matched' ? '匹配' : result.status === 'mismatched' ? '不匹配' : result.status === 'reviewed' ? '已复核' : '待处理',
      '差异类型': result.discrepancies.map(d => this.getDiscrepancyTypeName(d.type)).join('; '),
      '差异数量': result.discrepancies.length,
      '高严重性差异': highSeverity,
      '中严重性差异': mediumSeverity,
      '低严重性差异': lowSeverity,
      '对账时间': result.matchedAt ? dayjs(result.matchedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '复核时间': result.reviewedAt ? dayjs(result.reviewedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      '复核人': result.reviewedBy || '',
      '复核备注': result.reviewNotes || '',
    };
  }

  generateDiscrepancyReportCSV(): string {
    const results = this.dataStore.getAllReconciliations();
    const rows: Record<string, any>[] = [];

    for (const result of results) {
      const cv = this.dataStore.getCriticalValue(result.criticalValueId);
      for (const disc of result.discrepancies) {
        rows.push({
          '对账记录ID': result.id,
          '患者ID': cv?.patientId || '',
          '患者姓名': cv?.patientName || '',
          '科室': cv?.department || '',
          '检验项目': cv?.testItem || '',
          '差异类型': this.getDiscrepancyTypeName(disc.type),
          '严重性': disc.severity === 'high' ? '高' : disc.severity === 'medium' ? '中' : '低',
          '描述': disc.description,
          '详细信息': JSON.stringify(disc.details),
          '对账状态': result.status,
        });
      }
    }

    const parser = new Parser({
      fields: [
        '对账记录ID',
        '患者ID',
        '患者姓名',
        '科室',
        '检验项目',
        '差异类型',
        '严重性',
        '描述',
        '详细信息',
        '对账状态',
      ],
    });

    return parser.parse(rows);
  }

  generateSummaryReport(): any {
    const summary = this.engine.getSummary();
    const results = this.dataStore.getAllReconciliations();

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCriticalValues: summary.totalCriticalValues,
        totalCallbacks: summary.totalCallbacks,
        matchedCount: summary.matchedCount,
        mismatchedCount: summary.mismatchedCount,
        reviewedCount: summary.reviewedCount,
        matchRate: summary.totalCriticalValues > 0 
          ? ((summary.matchedCount + summary.reviewedCount) / summary.totalCriticalValues * 100).toFixed(2) + '%'
          : '0%',
      },
      discrepancyBreakdown: Object.entries(summary.discrepancyBreakdown).map(([type, count]) => ({
        type: this.getDiscrepancyTypeName(type as DiscrepancyType),
        typeCode: type,
        count,
      })).sort((a, b) => b.count - a.count),
      departmentStats: Object.entries(summary.departmentStats).map(([dept, stats]) => ({
        department: dept,
        total: stats.total,
        matched: stats.matched,
        mismatched: stats.mismatched,
        matchRate: stats.total > 0 ? ((stats.matched / stats.total) * 100).toFixed(2) + '%' : '0%',
      })).sort((a, b) => b.total - a.total),
      topIssues: this.getTopIssues(results, 10),
    };
  }

  private getTopIssues(results: ReconciliationResult[], limit: number): any[] {
    const mismatched = results.filter(r => r.status === 'mismatched');
    const sorted = mismatched.sort((a, b) => {
      const highA = a.discrepancies.filter(d => d.severity === 'high').length;
      const highB = b.discrepancies.filter(d => d.severity === 'high').length;
      return highB - highA;
    });

    return sorted.slice(0, limit).map(r => {
      const cv = this.dataStore.getCriticalValue(r.criticalValueId);
      return {
        reconciliationId: r.id,
        patientId: cv?.patientId,
        patientName: cv?.patientName,
        department: cv?.department,
        testItem: cv?.testItem,
        discrepancies: r.discrepancies.map(d => ({
          type: this.getDiscrepancyTypeName(d.type),
          severity: d.severity,
          description: d.description,
        })),
      };
    });
  }

  generateDetailedReport(reconciliationId: string): any {
    const details = this.engine.getReconciliationDetails(reconciliationId);
    if (!details) {
      throw new Error(`对账记录不存在: ${reconciliationId}`);
    }

    const reviewActions = this.dataStore.getReviewActions(reconciliationId);

    return {
      reconciliation: {
        id: details.reconciliation.id,
        status: details.reconciliation.status,
        matchedAt: details.reconciliation.matchedAt,
        reviewedAt: details.reconciliation.reviewedAt,
        reviewedBy: details.reconciliation.reviewedBy,
        reviewNotes: details.reconciliation.reviewNotes,
      },
      criticalValue: details.criticalValue ? {
        patientId: details.criticalValue.patientId,
        patientName: details.criticalValue.patientName,
        department: details.criticalValue.department,
        ward: details.criticalValue.ward,
        bedNo: details.criticalValue.bedNo,
        testItem: details.criticalValue.testItem,
        testResult: details.criticalValue.testResult,
        referenceRange: details.criticalValue.referenceRange,
        priority: details.criticalValue.priority,
        reportedAt: details.criticalValue.reportedAt,
        reportedBy: details.criticalValue.reportedBy,
        smsSentAt: details.criticalValue.smsSentAt,
        notes: details.criticalValue.notes,
      } : null,
      callback: details.callback ? {
        patientId: details.callback.patientId,
        patientName: details.callback.patientName,
        calledAt: details.callback.calledAt,
        calledBy: details.callback.calledBy,
        calledTo: details.callback.calledTo,
        doctorName: details.callback.doctorName,
        confirmedAt: details.callback.confirmedAt,
        confirmationNotes: details.callback.confirmationNotes,
        callResult: details.callback.callResult,
      } : null,
      discrepancies: details.reconciliation.discrepancies.map(d => ({
        type: this.getDiscrepancyTypeName(d.type),
        typeCode: d.type,
        description: d.description,
        severity: d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低',
        details: d.details,
      })),
      reviewHistory: reviewActions.map(a => ({
        action: a.actionType === 'confirm' ? '确认' : a.actionType === 'modify' ? '修改' : '忽略',
        fieldName: a.fieldName,
        oldValue: a.oldValue,
        newValue: a.newValue,
        performedBy: a.performedBy,
        performedAt: a.performedAt,
        notes: a.notes,
      })),
    };
  }

  private getDiscrepancyTypeName(type: DiscrepancyType): string {
    const names: Record<DiscrepancyType, string> = {
      no_callback: '未回告',
      callback_timeout: '回告超时',
      multiple_critical_values: '多次危急值',
      shift_gap: '夜班交接缺口',
      doctor_confirmation_missing: '医生确认缺失',
      data_inconsistency: '数据不一致',
    };
    return names[type] || type;
  }
}
