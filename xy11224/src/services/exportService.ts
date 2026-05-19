import { createObjectCsvWriter } from 'csv-writer';
import { Ticket, MonthlyReport, FaultType } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class ExportService {
  private exportDir: string;

  constructor(exportDir: string = './exports') {
    this.exportDir = exportDir;
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportTicketsToCSV(tickets: Ticket[], filename?: string): Promise<string> {
    const actualFilename = filename || `tickets_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join(this.exportDir, actualFilename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: '工单ID' },
        { id: 'externalId', title: '外部单号' },
        { id: 'cabinetId', title: '柜机ID' },
        { id: 'cabinetName', title: '柜机名称' },
        { id: 'faultType', title: '故障类型' },
        { id: 'faultTypeName', title: '故障类型名称' },
        { id: 'description', title: '故障描述' },
        { id: 'status', title: '状态' },
        { id: 'isOffline', title: '是否离线' },
        { id: 'reportedAt', title: '上报时间' },
        { id: 'receivedAt', title: '接单时间' },
        { id: 'analyzedAt', title: '归因时间' },
        { id: 'dispatchedAt', title: '派修时间' },
        { id: 'reviewedAt', title: '复核时间' },
        { id: 'resolvedAt', title: '解决时间' },
        { id: 'assignedTo', title: '派修人员' },
        { id: 'rootCause', title: '根本原因' },
        { id: 'resolution', title: '解决方案' },
        { id: 'mergedInto', title: '合并至' },
        { id: 'mergedCount', title: '合并工单数' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const records = tickets.map(t => ({
      id: t.id,
      externalId: t.externalId,
      cabinetId: t.cabinetId,
      cabinetName: t.cabinetName,
      faultType: t.faultType,
      faultTypeName: this.getFaultTypeName(t.faultType),
      description: t.description,
      status: t.status,
      isOffline: t.isOffline ? '是' : '否',
      reportedAt: t.reportedAt.toISOString(),
      receivedAt: t.receivedAt?.toISOString() || '',
      analyzedAt: t.analyzedAt?.toISOString() || '',
      dispatchedAt: t.dispatchedAt?.toISOString() || '',
      reviewedAt: t.reviewedAt?.toISOString() || '',
      resolvedAt: t.resolvedAt?.toISOString() || '',
      assignedTo: t.assignedTo || '',
      rootCause: t.rootCause || '',
      resolution: t.resolution || '',
      mergedInto: t.mergedInto || '',
      mergedCount: t.mergedTickets.length,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    }));

    await csvWriter.writeRecords(records);
    return filepath;
  }

  async exportMonthlyReportToCSV(report: MonthlyReport, filename?: string): Promise<string> {
    const actualFilename = filename || `monthly_report_${report.period}.csv`;
    const filepath = path.join(this.exportDir, actualFilename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'metric', title: '指标' },
        { id: 'value', title: '数值' },
        { id: 'notes', title: '说明' }
      ]
    });

    const records = [
      { metric: '统计周期', value: report.period, notes: '' },
      { metric: '总工单数', value: String(report.totalTickets), notes: '' },
      { metric: '柜门打不开', value: String(report.byFaultType[FaultType.CABINET_DOOR_FAILURE]), notes: '按故障类型' },
      { metric: '扫码失败', value: String(report.byFaultType[FaultType.SCAN_FAILURE]), notes: '按故障类型' },
      { metric: '空仓误报', value: String(report.byFaultType[FaultType.FALSE_EMPTY_SLOT_ALARM]), notes: '按故障类型' },
      { metric: '其他故障', value: String(report.byFaultType[FaultType.OTHER]), notes: '按故障类型' },
      { metric: '已合并工单数', value: String(report.mergedTickets), notes: '重复故障合并' },
      { metric: '离线排除数', value: String(report.offlineExcluded), notes: '离线柜机排除' },
      { metric: '已派修数', value: String(report.dispatchedCount), notes: '' },
      { metric: '已复核数', value: String(report.reviewedCount), notes: '' },
      { metric: '平均解决时长(小时)', value: report.averageResolutionTime ? String((report.averageResolutionTime / 3600000).toFixed(2)) : '-', notes: '从接单到解决' }
    ];

    await csvWriter.writeRecords(records);
    return filepath;
  }

  async exportRuleResultsToCSV(ticket: Ticket, filename?: string): Promise<string> {
    const actualFilename = filename || `rule_results_${ticket.externalId}.csv`;
    const filepath = path.join(this.exportDir, actualFilename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'ruleName', title: '规则名称' },
        { id: 'action', title: '执行动作' },
        { id: 'reason', title: '原因' },
        { id: 'timestamp', title: '执行时间' },
        { id: 'details', title: '详细信息' }
      ]
    });

    const records = ticket.ruleResults.map(r => ({
      ruleName: r.ruleName,
      action: r.action,
      reason: r.reason,
      timestamp: r.timestamp.toISOString(),
      details: JSON.stringify(r.details || {})
    }));

    await csvWriter.writeRecords(records);
    return filepath;
  }

  private getFaultTypeName(faultType: FaultType): string {
    const names: Record<FaultType, string> = {
      [FaultType.CABINET_DOOR_FAILURE]: '柜门打不开',
      [FaultType.SCAN_FAILURE]: '扫码失败',
      [FaultType.FALSE_EMPTY_SLOT_ALARM]: '空仓误报',
      [FaultType.OTHER]: '其他故障'
    };
    return names[faultType] || faultType;
  }

  getExportDir(): string {
    return this.exportDir;
  }
}