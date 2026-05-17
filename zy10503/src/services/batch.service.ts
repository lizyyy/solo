import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../database/schema';
import { BatchStatus, NotificationChannel, ReceiptStatus, type CreateBatchRequest, type NotificationBatch } from '../types';

export class BatchService {
  constructor(private db: Database) {}

  generateBatchNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BATCH${dateStr}${random}`;
  }

  async createBatch(request: CreateBatchRequest): Promise<NotificationBatch> {
    const now = Date.now();
    const batchId = uuidv4();
    const batchNo = this.generateBatchNo();

    const batch: NotificationBatch = {
      id: batchId,
      batchNo,
      title: request.title,
      content: request.content,
      channel: request.channel,
      totalCount: request.tenants.length,
      successCount: 0,
      failedCount: 0,
      confirmedCount: 0,
      status: BatchStatus.DRAFT,
      createdBy: request.createdBy,
      createdAt: now,
      updatedAt: now,
      remark: request.remark
    };

    await this.db.run(
      `INSERT INTO notification_batches (
        id, batch_no, title, content, channel, total_count, 
        success_count, failed_count, confirmed_count, status, 
        created_by, created_at, updated_at, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id, batch.batchNo, batch.title, batch.content, batch.channel,
        batch.totalCount, batch.successCount, batch.failedCount,
        batch.confirmedCount, batch.status, batch.createdBy,
        batch.createdAt, batch.updatedAt, batch.remark
      ]
    );

    const maxRetry = request.maxRetry ?? 3;

    for (const tenant of request.tenants) {
      const receiptId = uuidv4();
      const idempotentKey = `${batchId}:${tenant.tenantId}:${request.channel}:${now}`;

      await this.db.run(
        `INSERT INTO notification_receipts (
          id, batch_id, tenant_id, channel, target, status,
          retry_count, max_retry, receipt_idempotent_key,
          original_input, processing_basis, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          receiptId, batchId, tenant.tenantId, request.channel, tenant.target,
          ReceiptStatus.PENDING, 0, maxRetry, idempotentKey,
          JSON.stringify({ tenant, batch: { title: request.title, content: request.content } }),
          `批量创建，批次号: ${batchNo}`, now, now
        ]
      );

      await this.db.run(
        `INSERT OR IGNORE INTO tenant_accounts (
          id, tenant_id, tenant_name, contact, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenant.tenantId, tenant.tenantName, tenant.contact || '', now, now]
      );
    }

    return batch;
  }

  async startBatch(batchId: string): Promise<NotificationBatch> {
    const now = Date.now();
    await this.db.run(
      `UPDATE notification_batches SET status = ?, updated_at = ? WHERE id = ?`,
      [BatchStatus.PROCESSING, now, batchId]
    );

    await this.db.run(
      `UPDATE notification_receipts SET status = ?, sent_at = ?, updated_at = ? 
       WHERE batch_id = ? AND status = ?`,
      [ReceiptStatus.SENT, now, now, batchId, ReceiptStatus.PENDING]
    );

    return this.getBatchById(batchId) as Promise<NotificationBatch>;
  }

  async getBatchById(batchId: string): Promise<NotificationBatch | null> {
    const row = await this.db.get(
      `SELECT * FROM notification_batches WHERE id = ?`,
      [batchId]
    );

    if (!row) return null;

    return {
      id: row.id,
      batchNo: row.batch_no,
      title: row.title,
      content: row.content,
      channel: row.channel as NotificationChannel,
      totalCount: row.total_count,
      successCount: row.success_count,
      failedCount: row.failed_count,
      confirmedCount: row.confirmed_count,
      status: row.status as BatchStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      remark: row.remark
    };
  }

  async listBatches(page: number = 1, pageSize: number = 20): Promise<{ batches: NotificationBatch[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const batches = await this.db.all(
      `SELECT * FROM notification_batches ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const totalResult = await this.db.get(`SELECT COUNT(*) as count FROM notification_batches`);

    return {
      batches: batches.map(row => ({
        id: row.id,
        batchNo: row.batch_no,
        title: row.title,
        content: row.content,
        channel: row.channel as NotificationChannel,
        totalCount: row.total_count,
        successCount: row.success_count,
        failedCount: row.failed_count,
        confirmedCount: row.confirmed_count,
        status: row.status as BatchStatus,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        remark: row.remark
      })),
      total: totalResult?.count || 0
    };
  }

  async updateBatchStats(batchId: string): Promise<void> {
    const stats = await this.db.get(
      `SELECT 
        COUNT(CASE WHEN status IN ('sent', 'delivered', 'confirmed') THEN 1 END) as success_count,
        COUNT(CASE WHEN status IN ('failed', 'timeout') THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count
       FROM notification_receipts WHERE batch_id = ?`,
      [batchId]
    );

    await this.db.run(
      `UPDATE notification_batches 
       SET success_count = ?, failed_count = ?, confirmed_count = ?, updated_at = ?
       WHERE id = ?`,
      [stats?.success_count || 0, stats?.failed_count || 0, stats?.confirmed_count || 0, Date.now(), batchId]
    );

    const batch = await this.getBatchById(batchId);
    if (batch) {
      let newStatus = batch.status;
      if (batch.failedCount === 0 && batch.successCount === batch.totalCount) {
        newStatus = BatchStatus.COMPLETED;
      } else if (batch.failedCount > 0) {
        newStatus = BatchStatus.PARTIAL_FAILED;
      }

      if (newStatus !== batch.status) {
        await this.db.run(
          `UPDATE notification_batches SET status = ?, updated_at = ? WHERE id = ?`,
          [newStatus, Date.now(), batchId]
        );
      }
    }
  }
}
