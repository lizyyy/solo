import { v4 as uuidv4 } from 'uuid';
import { runQuery, runExecute } from '../database/db';

export interface ReceiptRequest {
  batchId?: string;
  channelCode: string;
  transactionId: string;
  amount: number;
  manualRemark: string;
  callerId: string;
}

export class PaymentService {
  async createReceipt(request: ReceiptRequest) {
    const receiptId = uuidv4();
    await runExecute(
      'INSERT INTO payment_receipts (id, batch_id, channel_code, transaction_id, amount, manual_remark, caller_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        receiptId,
        request.batchId || null,
        request.channelCode,
        request.transactionId,
        request.amount,
        request.manualRemark,
        request.callerId,
      ]
    );

    return {
      id: receiptId,
      ...request,
      createdAt: new Date().toISOString(),
    };
  }

  async getReceiptsByCaller(callerId: string) {
    return await runQuery(
      `SELECT 
        pr.*,
        d.name as department_name,
        qb.rule_version
      FROM payment_receipts pr
      LEFT JOIN quota_batches qb ON pr.batch_id = qb.id
      LEFT JOIN departments d ON qb.department_id = d.id
      WHERE pr.caller_id = ?
      ORDER BY pr.created_at DESC`,
      [callerId]
    );
  }

  async getReceiptsByBatch(batchId: string) {
    return await runQuery(
      `SELECT 
        pr.*,
        d.name as department_name
      FROM payment_receipts pr
      LEFT JOIN quota_batches qb ON pr.batch_id = qb.id
      LEFT JOIN departments d ON qb.department_id = d.id
      WHERE pr.batch_id = ?
      ORDER BY pr.created_at DESC`,
      [batchId]
    );
  }

  async updateRemark(receiptId: string, manualRemark: string, callerId: string) {
    await runExecute(
      'UPDATE payment_receipts SET manual_remark = ? WHERE id = ?',
      [manualRemark, receiptId]
    );

    return {
      id: receiptId,
      manualRemark,
      updatedBy: callerId,
      updatedAt: new Date().toISOString(),
    };
  }

  async getAllReceipts() {
    return await runQuery(`
      SELECT 
        pr.*,
        d.name as department_name,
        qb.rule_version
      FROM payment_receipts pr
      LEFT JOIN quota_batches qb ON pr.batch_id = qb.id
      LEFT JOIN departments d ON qb.department_id = d.id
      ORDER BY pr.created_at DESC
    `);
  }
}

export default new PaymentService();
