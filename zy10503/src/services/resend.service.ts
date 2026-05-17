import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../database/schema';
import { ResendStatus, ReceiptStatus, NotificationChannel, type ResendRequest } from '../types';

export class ResendService {
  constructor(private db: Database) {}

  async createResendRecords(request: ResendRequest): Promise<{ count: number; records: any[] }> {
    const now = Date.now();
    const createdRecords: any[] = [];

    for (const receiptId of request.receiptIds) {
      const receipt = await this.db.get(
        `SELECT * FROM notification_receipts WHERE id = ?`,
        [receiptId]
      );

      if (!receipt) {
        continue;
      }

      const resendId = uuidv4();
      const channel = request.channel || receipt.channel;
      const target = request.target || receipt.target;

      await this.db.run(
        `INSERT INTO resend_records (
          id, receipt_id, batch_id, tenant_id, channel, target, status,
          resend_count, max_resend, original_receipt_id, original_input,
          processing_basis, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resendId, receiptId, receipt.batch_id, receipt.tenant_id, channel, target,
          ResendStatus.PENDING, 0, 3, receipt.id,
          JSON.stringify({ originalReceipt: receipt, operator: request.operator, remark: request.remark }),
          `创建补发记录，操作人: ${request.operator}${request.remark ? `，备注: ${request.remark}` : ''}`,
          now, now
        ]
      );

      await this.db.run(
        `UPDATE notification_receipts SET status = ?, updated_at = ? WHERE id = ?`,
        [ReceiptStatus.RESENT, now, receiptId]
      );

      createdRecords.push({
        id: resendId,
        receiptId,
        batchId: receipt.batch_id,
        tenantId: receipt.tenant_id
      });
    }

    return {
      count: createdRecords.length,
      records: createdRecords
    };
  }

  async startResend(resendId: string): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `UPDATE resend_records 
       SET status = ?, resend_count = resend_count + 1, last_resend_at = ?, updated_at = ?
       WHERE id = ?`,
      [ResendStatus.PROCESSING, now, now, resendId]
    );
  }

  async markResendSuccess(resendId: string): Promise<void> {
    const now = Date.now();
    const resend = await this.db.get(
      `SELECT receipt_id FROM resend_records WHERE id = ?`,
      [resendId]
    );

    await this.db.run(
      `UPDATE resend_records SET status = ?, updated_at = ? WHERE id = ?`,
      [ResendStatus.SUCCESS, now, resendId]
    );

    if (resend) {
      await this.db.run(
        `UPDATE notification_receipts SET status = ?, sent_at = ?, updated_at = ? WHERE id = ?`,
        [ReceiptStatus.SENT, now, now, resend.receipt_id]
      );
    }
  }

  async markResendFailed(resendId: string, failReason: string): Promise<void> {
    const now = Date.now();
    const resend = await this.db.get(
      `SELECT receipt_id, resend_count, max_resend FROM resend_records WHERE id = ?`,
      [resendId]
    );

    if (!resend) return;

    const shouldFinalFail = resend.resend_count >= resend.max_resend;

    await this.db.run(
      `UPDATE resend_records 
       SET status = ?, fail_reason = ?, updated_at = ?,
           next_resend_at = ?
       WHERE id = ?`,
      [
        shouldFinalFail ? ResendStatus.FAILED : ResendStatus.PENDING,
        failReason, now,
        shouldFinalFail ? undefined : now + 300000,
        resendId
      ]
    );

    if (shouldFinalFail && resend.receipt_id) {
      await this.db.run(
        `UPDATE notification_receipts 
         SET status = ?, fail_reason = ?, final_conclusion = ?, updated_at = ?
         WHERE id = ?`,
        [ReceiptStatus.FAILED, failReason, `补发${resend.max_resend}次均失败`, now, resend.receipt_id]
      );
    }
  }

  async getPendingResends(): Promise<any[]> {
    const now = Date.now();
    const rows = await this.db.all(
      `SELECT * FROM resend_records 
       WHERE status = ? AND (next_resend_at IS NULL OR next_resend_at <= ?)
       ORDER BY created_at ASC`,
      [ResendStatus.PENDING, now]
    );

    return rows.map(row => ({
      id: row.id,
      receiptId: row.receipt_id,
      batchId: row.batch_id,
      tenantId: row.tenant_id,
      channel: row.channel,
      target: row.target,
      resendCount: row.resend_count,
      maxResend: row.max_resend,
      originalInput: JSON.parse(row.original_input || '{}'),
      processingBasis: row.processing_basis
    }));
  }

  async getResendRecordsByBatch(batchId: string): Promise<any[]> {
    const rows = await this.db.all(
      `SELECT * FROM resend_records WHERE batch_id = ? ORDER BY created_at DESC`,
      [batchId]
    );

    return rows.map(row => ({
      id: row.id,
      receiptId: row.receipt_id,
      tenantId: row.tenant_id,
      channel: row.channel,
      target: row.target,
      status: row.status,
      resendCount: row.resend_count,
      failReason: row.fail_reason,
      lastResendAt: row.last_resend_at,
      createdAt: row.created_at
    }));
  }
}
