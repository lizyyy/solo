import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../database/schema';
import { ReceiptStatus, NotificationChannel, type NotificationReceipt, type QueryReceiptRequest, type ManualCorrectRequest } from '../types';

export class ReceiptService {
  constructor(private db: Database) {}

  private parseReceiptRow(row: any): NotificationReceipt {
    return {
      id: row.id,
      batchId: row.batch_id,
      tenantId: row.tenant_id,
      channel: row.channel as NotificationChannel,
      target: row.target,
      status: row.status as ReceiptStatus,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      confirmedAt: row.confirmed_at,
      failedAt: row.failed_at,
      failReason: row.fail_reason,
      retryCount: row.retry_count,
      maxRetry: row.max_retry,
      receiptIdempotentKey: row.receipt_idempotent_key,
      originalInput: JSON.parse(row.original_input || '{}'),
      processingBasis: row.processing_basis,
      finalConclusion: row.final_conclusion,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getReceiptById(receiptId: string): Promise<NotificationReceipt | null> {
    const row = await this.db.get(
      `SELECT * FROM notification_receipts WHERE id = ?`,
      [receiptId]
    );
    return row ? this.parseReceiptRow(row) : null;
  }

  async queryReceipts(request: QueryReceiptRequest): Promise<{ receipts: NotificationReceipt[]; total: number }> {
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];

    if (request.batchId) {
      conditions.push('batch_id = ?');
      params.push(request.batchId);
    }
    if (request.tenantId) {
      conditions.push('tenant_id = ?');
      params.push(request.tenantId);
    }
    if (request.status) {
      conditions.push('status = ?');
      params.push(request.status);
    }
    if (request.channel) {
      conditions.push('channel = ?');
      params.push(request.channel);
    }
    if (request.startAt) {
      conditions.push('created_at >= ?');
      params.push(request.startAt);
    }
    if (request.endAt) {
      conditions.push('created_at <= ?');
      params.push(request.endAt);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.all(
      `SELECT * FROM notification_receipts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalResult = await this.db.get(
      `SELECT COUNT(*) as count FROM notification_receipts ${whereClause}`,
      params
    );

    return {
      receipts: rows.map(row => this.parseReceiptRow(row)),
      total: totalResult?.count || 0
    };
  }

  async confirmReceipt(receiptId: string, confirmedBy?: string, confirmedAt?: number): Promise<NotificationReceipt> {
    const now = confirmedAt ?? Date.now();
    
    const existing = await this.db.get(
      `SELECT status, confirmed_at FROM notification_receipts WHERE id = ?`,
      [receiptId]
    );

    if (!existing) {
      throw new Error('回执不存在');
    }

    if (existing.status === ReceiptStatus.CONFIRMED && existing.confirmed_at) {
      throw new Error('回执已确认，不可重复确认');
    }

    const processingBasis = confirmedBy 
      ? `人工确认，操作人: ${confirmedBy}` 
      : '系统自动确认';

    await this.db.run(
      `UPDATE notification_receipts 
       SET status = ?, confirmed_at = ?, updated_at = ?, final_conclusion = ?
       WHERE id = ?`,
      [ReceiptStatus.CONFIRMED, now, now, `已确认，确认时间: ${new Date(now).toISOString()}`, receiptId]
    );

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new Error('回执不存在');
    }

    return receipt;
  }

  async markDelivered(receiptId: string): Promise<NotificationReceipt> {
    const now = Date.now();
    await this.db.run(
      `UPDATE notification_receipts 
       SET status = ?, delivered_at = ?, updated_at = ?
       WHERE id = ?`,
      [ReceiptStatus.DELIVERED, now, now, receiptId]
    );

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new Error('回执不存在');
    }

    return receipt;
  }

  async markFailed(receiptId: string, failReason: string): Promise<NotificationReceipt> {
    const now = Date.now();
    
    const existing = await this.db.get(
      `SELECT retry_count, max_retry FROM notification_receipts WHERE id = ?`,
      [receiptId]
    );

    if (!existing) {
      throw new Error('回执不存在');
    }

    const newRetryCount = existing.retry_count + 1;
    const shouldFinalFail = newRetryCount >= existing.max_retry;

    const processingBasis = shouldFinalFail 
      ? `达到最大重试次数(${existing.max_retry})，标记为最终失败` 
      : `发送失败，重试次数: ${newRetryCount}/${existing.max_retry}`;

    await this.db.run(
      `UPDATE notification_receipts 
       SET status = ?, failed_at = ?, fail_reason = ?, retry_count = ?, 
           updated_at = ?, processing_basis = ?, final_conclusion = ?
       WHERE id = ?`,
      [
        shouldFinalFail ? ReceiptStatus.FAILED : ReceiptStatus.PENDING,
        now, failReason, newRetryCount, now, processingBasis,
        shouldFinalFail ? `最终失败: ${failReason}` : undefined,
        receiptId
      ]
    );

    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new Error('回执不存在');
    }

    return receipt;
  }

  async processTimeout(batchId: string, timeoutMinutes: number = 60): Promise<number> {
    const now = Date.now();
    const timeoutThreshold = now - (timeoutMinutes * 60 * 1000);

    const result = await this.db.run(
      `UPDATE notification_receipts 
       SET status = ?, updated_at = ?, final_conclusion = ?
       WHERE batch_id = ? AND status IN (?, ?) AND sent_at < ?`,
      [
        ReceiptStatus.TIMEOUT, now, 
        `确认超时(${timeoutMinutes}分钟未确认)`,
        batchId, ReceiptStatus.SENT, ReceiptStatus.DELIVERED, timeoutThreshold
      ]
    );

    return result.changes ?? 0;
  }

  async manualCorrect(request: ManualCorrectRequest): Promise<NotificationReceipt> {
    const now = Date.now();
    const existing = await this.getReceiptById(request.receiptId);

    if (!existing) {
      throw new Error('回执不存在');
    }

    const processingBasis = `人工修正，原状态: ${existing.status} -> 新状态: ${request.targetStatus}, 原因: ${request.reason}, 操作人: ${request.operator}`;
    const finalConclusion = `人工修正，状态: ${request.targetStatus}，修正时间: ${new Date(now).toISOString()}`;

    await this.db.run(
      `UPDATE notification_receipts 
       SET status = ?, updated_at = ?, processing_basis = ?, final_conclusion = ?
       WHERE id = ?`,
      [request.targetStatus, now, processingBasis, finalConclusion, request.receiptId]
    );

    const receipt = await this.getReceiptById(request.receiptId);
    if (!receipt) {
      throw new Error('回执不存在');
    }

    return receipt;
  }

  async checkDuplicateReceipt(batchId: string, tenantId: string, channel: NotificationChannel): Promise<boolean> {
    const existing = await this.db.get(
      `SELECT id FROM notification_receipts 
       WHERE batch_id = ? AND tenant_id = ? AND channel = ? AND status != ?`,
      [batchId, tenantId, channel, ReceiptStatus.FAILED]
    );
    return !!existing;
  }

  async getReceiptTrace(receiptId: string): Promise<{ receipt: NotificationReceipt; resendRecords: any[] }> {
    const receipt = await this.getReceiptById(receiptId);
    if (!receipt) {
      throw new Error('回执不存在');
    }

    const resendRecords = await this.db.all(
      `SELECT * FROM resend_records WHERE receipt_id = ? ORDER BY created_at DESC`,
      [receiptId]
    );

    return {
      receipt,
      resendRecords: resendRecords.map(row => ({
        id: row.id,
        status: row.status,
        resendCount: row.resend_count,
        lastResendAt: row.last_resend_at,
        failReason: row.fail_reason,
        originalInput: JSON.parse(row.original_input || '{}'),
        processingBasis: row.processing_basis,
        createdAt: row.created_at
      }))
    };
  }
}
