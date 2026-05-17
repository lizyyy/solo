import { v4 as uuidv4 } from 'uuid';
import { createObjectCsvStringifier } from 'csv-writer';
import type { Database } from '../database/schema';
import { NotificationChannel, ReceiptStatus, type ReachSummary } from '../types';

export class ExportService {
  constructor(private db: Database) {}

  async generateSummary(batchId: string): Promise<ReachSummary> {
    const now = Date.now();

    const channelStats = await this.db.all(
      `SELECT channel,
              COUNT(CASE WHEN status IN ('sent', 'delivered', 'confirmed', 'resent') THEN 1 END) as total_sent,
              COUNT(CASE WHEN status IN ('delivered', 'confirmed') THEN 1 END) as total_delivered,
              COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as total_confirmed,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
              COUNT(CASE WHEN status = 'timeout' THEN 1 END) as total_timeout,
              COUNT(CASE WHEN status = 'resent' THEN 1 END) as total_resent
       FROM notification_receipts
       WHERE batch_id = ?
       GROUP BY channel`,
      [batchId]
    );

    const summaries: ReachSummary[] = [];

    for (const stat of channelStats) {
      const summaryId = uuidv4();
      const total = stat.total_sent + stat.total_failed + stat.total_timeout;
      const deliveryRate = total > 0 ? stat.total_delivered / total : 0;
      const confirmationRate = total > 0 ? stat.total_confirmed / total : 0;
      const failureRate = total > 0 ? (stat.total_failed + stat.total_timeout) / total : 0;

      await this.db.run(
        `INSERT INTO reach_summaries (
          id, batch_id, channel, total_sent, total_delivered,
          total_confirmed, total_failed, total_timeout, total_resent,
          delivery_rate, confirmation_rate, failure_rate, calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summaryId, batchId, stat.channel, stat.total_sent, stat.total_delivered,
          stat.total_confirmed, stat.total_failed, stat.total_timeout, stat.total_resent,
          deliveryRate, confirmationRate, failureRate, now
        ]
      );

      summaries.push({
        id: summaryId,
        batchId,
        channel: stat.channel as NotificationChannel,
        totalSent: stat.total_sent,
        totalDelivered: stat.total_delivered,
        totalConfirmed: stat.total_confirmed,
        totalFailed: stat.total_failed,
        totalTimeout: stat.total_timeout,
        totalResent: stat.total_resent,
        deliveryRate,
        confirmationRate,
        failureRate,
        calculatedAt: now
      });
    }

    if (summaries.length === 0) {
      const summaryId = uuidv4();
      await this.db.run(
        `INSERT INTO reach_summaries (
          id, batch_id, channel, total_sent, total_delivered,
          total_confirmed, total_failed, total_timeout, total_resent,
          delivery_rate, confirmation_rate, failure_rate, calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [summaryId, batchId, 'unknown', 0, 0, 0, 0, 0, 0, 0, 0, 0, now]
      );

      summaries.push({
        id: summaryId,
        batchId,
        channel: 'unknown' as NotificationChannel,
        totalSent: 0,
        totalDelivered: 0,
        totalConfirmed: 0,
        totalFailed: 0,
        totalTimeout: 0,
        totalResent: 0,
        deliveryRate: 0,
        confirmationRate: 0,
        failureRate: 0,
        calculatedAt: now
      });
    }

    return summaries[0];
  }

  async getSummary(batchId: string): Promise<ReachSummary[]> {
    const rows = await this.db.all(
      `SELECT * FROM reach_summaries WHERE batch_id = ? ORDER BY calculated_at DESC`,
      [batchId]
    );

    return rows.map(row => ({
      id: row.id,
      batchId: row.batch_id,
      channel: row.channel as NotificationChannel,
      totalSent: row.total_sent,
      totalDelivered: row.total_delivered,
      totalConfirmed: row.total_confirmed,
      totalFailed: row.total_failed,
      totalTimeout: row.total_timeout,
      totalResent: row.total_resent,
      deliveryRate: row.delivery_rate,
      confirmationRate: row.confirmation_rate,
      failureRate: row.failure_rate,
      calculatedAt: row.calculated_at
    }));
  }

  async exportReceiptsToCsv(batchId: string): Promise<string> {
    const receipts = await this.db.all(
      `SELECT r.*, t.tenant_name
       FROM notification_receipts r
       LEFT JOIN tenant_accounts t ON r.tenant_id = t.tenant_id
       WHERE r.batch_id = ?
       ORDER BY r.created_at DESC`,
      [batchId]
    );

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'tenantId', title: '租户ID' },
        { id: 'tenantName', title: '租户名称' },
        { id: 'channel', title: '发送渠道' },
        { id: 'target', title: '接收账号' },
        { id: 'status', title: '状态' },
        { id: 'sentAt', title: '发送时间' },
        { id: 'deliveredAt', title: '送达时间' },
        { id: 'confirmedAt', title: '确认时间' },
        { id: 'failReason', title: '失败原因' },
        { id: 'retryCount', title: '重试次数' },
        { id: 'finalConclusion', title: '最终结论' },
        { id: 'processingBasis', title: '处理依据' }
      ]
    });

    const records = receipts.map(row => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || '-',
      channel: row.channel,
      target: row.target,
      status: this.formatStatus(row.status),
      sentAt: row.sent_at ? new Date(row.sent_at).toLocaleString('zh-CN') : '-',
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toLocaleString('zh-CN') : '-',
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toLocaleString('zh-CN') : '-',
      failReason: row.fail_reason || '-',
      retryCount: row.retry_count,
      finalConclusion: row.final_conclusion || '-',
      processingBasis: row.processing_basis || '-'
    }));

    return '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  async exportSummaryToCsv(batchId: string): Promise<string> {
    const summaries = await this.getSummary(batchId);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'channel', title: '发送渠道' },
        { id: 'totalSent', title: '发送总数' },
        { id: 'totalDelivered', title: '送达数' },
        { id: 'totalConfirmed', title: '确认数' },
        { id: 'totalFailed', title: '失败数' },
        { id: 'totalTimeout', title: '超时数' },
        { id: 'totalResent', title: '补发数' },
        { id: 'deliveryRate', title: '送达率' },
        { id: 'confirmationRate', title: '确认率' },
        { id: 'failureRate', title: '失败率' },
        { id: 'calculatedAt', title: '统计时间' }
      ]
    });

    const records = summaries.map(row => ({
      channel: row.channel,
      totalSent: row.totalSent,
      totalDelivered: row.totalDelivered,
      totalConfirmed: row.totalConfirmed,
      totalFailed: row.totalFailed,
      totalTimeout: row.totalTimeout,
      totalResent: row.totalResent,
      deliveryRate: `${(row.deliveryRate * 100).toFixed(2)}%`,
      confirmationRate: `${(row.confirmationRate * 100).toFixed(2)}%`,
      failureRate: `${(row.failureRate * 100).toFixed(2)}%`,
      calculatedAt: new Date(row.calculatedAt).toLocaleString('zh-CN')
    }));

    return '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      [ReceiptStatus.PENDING]: '待发送',
      [ReceiptStatus.SENT]: '已发送',
      [ReceiptStatus.DELIVERED]: '已送达',
      [ReceiptStatus.CONFIRMED]: '已确认',
      [ReceiptStatus.FAILED]: '发送失败',
      [ReceiptStatus.TIMEOUT]: '确认超时',
      [ReceiptStatus.RESENT]: '补发中'
    };
    return statusMap[status] || status;
  }
}
