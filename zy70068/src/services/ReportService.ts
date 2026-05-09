import { RunReport } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { lineService } from './LineService';
import { detourService } from './DetourService';
import { receiptService } from './ReceiptService';
import { notificationService } from './NotificationService';
import { etaService } from './EtaService';

export class ReportService {
  generateRunReport(lineId: string, date?: string): RunReport {
    const reportDate = date ?? this.formatDate(new Date());
    const lineVersion = lineService.getActiveLineVersion(lineId);
    
    const allDetours = repository.getAllDetourEvents();
    const dateDetours = allDetours.filter(
      (d) => this.formatDate(d.reportedAt) === reportDate ||
             (d.startTime && this.formatDate(d.startTime) === reportDate)
    );

    const detourSummary = dateDetours.map((d) => ({
      eventId: d.id,
      reason: d.reason,
      status: d.status,
      affectedStops: d.affectedStopIds,
    }));

    const allNotifications = repository.getAllNotifications();
    const dateNotifications = allNotifications.filter(
      (n) => this.formatDate(n.createdAt) === reportDate
    );

    const notificationStats = {
      total: dateNotifications.length,
      sent: dateNotifications.filter((n) => n.status === 'SENT').length,
      failed: dateNotifications.filter(
        (n) => n.status === 'FAILED' && n.retryCount >= n.maxRetries
      ).length,
      deduplicated: 0,
    };

    const allReceipts = repository.getAllDriverReceipts();
    const dateReceipts = allReceipts.filter(
      (r) => this.formatDate(r.createdAt) === reportDate
    );

    const receiptStats = {
      total: dateReceipts.length,
      acknowledged: dateReceipts.filter((r) => r.status === 'ACKNOWLEDGED').length,
      rejected: dateReceipts.filter((r) => r.status === 'REJECTED').length,
      timedOut: dateReceipts.filter((r) => r.status === 'TIMED_OUT').length,
    };

    const totalStops = lineVersion.stops.length;
    const completedStops = this.countCompletedStops(lineId, reportDate);

    const report: RunReport = {
      id: repository.generateId(),
      date: reportDate,
      lineId,
      lineVersionId: lineVersion.id,
      totalStops,
      completedStops,
      detourEvents: detourSummary,
      notifications: notificationStats,
      driverReceipts: receiptStats,
      generatedAt: new Date(),
    };

    return repository.saveRunReport(report);
  }

  private countCompletedStops(lineId: string, reportDate: string): number {
    const lineVersion = lineService.getActiveLineVersion(lineId);
    let completed = 0;

    for (const stop of lineVersion.stops) {
      const eta = repository.findLatestEta(stop.id, lineId);
      if (eta && eta.actualArrival && this.formatDate(eta.actualArrival) === reportDate) {
        completed++;
      }
    }

    return completed;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getRunReport(lineId: string, date?: string): RunReport | undefined {
    const reportDate = date ?? this.formatDate(new Date());
    return repository.findRunReport(reportDate, lineId);
  }

  getDetailedSummary(lineId: string): {
    lineName: string;
    activeDetours: number;
    totalNotifications: number;
    notificationDeliveryRate: number;
    receiptAcknowledgementRate: number;
  } {
    const lineVersion = lineService.getActiveLineVersion(lineId);
    const activeDetours = detourService.getActiveDetours(lineId);
    const notificationStats = notificationService.getStatistics();

    const allReceipts = repository.getAllDriverReceipts();
    const nonTimedOutReceipts = allReceipts.filter((r) => r.status !== 'TIMED_OUT');
    const acknowledgedCount = nonTimedOutReceipts.filter((r) => r.status === 'ACKNOWLEDGED').length;

    return {
      lineName: lineVersion.lineName,
      activeDetours: activeDetours.length,
      totalNotifications: notificationStats.total,
      notificationDeliveryRate: notificationStats.total > 0
        ? notificationStats.sent / notificationStats.total
        : 0,
      receiptAcknowledgementRate: nonTimedOutReceipts.length > 0
        ? acknowledgedCount / nonTimedOutReceipts.length
        : 0,
    };
  }

  exportReport(report: RunReport): string {
    const parts = [
      `=== 校车运行报告 ===`,
      `日期: ${report.date}`,
      `线路: ${lineService.getActiveLineVersion(report.lineId).lineName} (版本: ${report.lineVersionId})`,
      ``,
      `站点进度: ${report.completedStops}/${report.totalStops}`,
      ``,
      `--- 绕行事件 ---`,
    ];

    if (report.detourEvents.length === 0) {
      parts.push('无绕行事件');
    } else {
      report.detourEvents.forEach((d, i) => {
        parts.push(`${i + 1}. [${d.status}] ${d.reason} - 影响站点: ${d.affectedStops.length}个`);
      });
    }

    parts.push(
      ``,
      `--- 通知统计 ---`,
      `总数: ${report.notifications.total}`,
      `发送成功: ${report.notifications.sent}`,
      `发送失败: ${report.notifications.failed}`,
      ``,
      `--- 回执统计 ---`,
      `总数: ${report.driverReceipts.total}`,
      `已确认: ${report.driverReceipts.acknowledged}`,
      `已拒绝: ${report.driverReceipts.rejected}`,
      `已超时: ${report.driverReceipts.timedOut}`,
      ``,
      `报告生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`
    );

    return parts.join('\n');
  }
}

export const reportService = new ReportService();
