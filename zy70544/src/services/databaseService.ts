import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  RecalculationApplication,
  ImpactDetail,
  ApprovalHistory,
  RecalculationSnapshot,
  CreateApplicationRequest,
  UpdateStatusRequest,
  ManualCorrectionRequest,
  RecalculationStatus
} from '../types';

export class DatabaseService {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  private runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  private allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async findByIdempotencyKey(key: string): Promise<RecalculationApplication | undefined> {
    const row = await this.getAsync<any>(
      'SELECT * FROM recalculation_applications WHERE idempotency_key = ?',
      [key]
    );
    if (!row) return undefined;
    return this.mapToApplication(row);
  }

  async createApplication(request: CreateApplicationRequest): Promise<RecalculationApplication> {
    const now = new Date().toISOString();
    const id = uuidv4();

    const totalOriginalAmount = request.impactDetails.reduce((sum, d) => sum + d.originalAmount, 0);
    const totalNewAmount = request.impactDetails.reduce((sum, d) => sum + d.newAmount, 0);
    const totalDifference = totalNewAmount - totalOriginalAmount;

    await this.runAsync(
      `INSERT INTO recalculation_applications (
        id, idempotency_key, billing_month, customer_account, customer_name,
        reason_category, reason_detail, trigger_source,
        total_original_amount, total_new_amount, total_difference,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, request.idempotencyKey, request.billingMonth, request.customerAccount, request.customerName,
        request.reasonCategory, request.reasonDetail, request.triggerSource,
        totalOriginalAmount, totalNewAmount, totalDifference,
        RecalculationStatus.DRAFT, request.createdBy, now, now
      ]
    );

    for (const detail of request.impactDetails) {
      const detailId = uuidv4();
      const difference = detail.newAmount - detail.originalAmount;
      await this.runAsync(
        `INSERT INTO impact_details (
          id, application_id, item_code, item_name, original_amount, new_amount, difference, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [detailId, id, detail.itemCode, detail.itemName, detail.originalAmount, detail.newAmount, difference, detail.remarks, now]
      );
    }

    await this.createSnapshot(id, 'ORIGINAL_INPUT', JSON.stringify(request));

    return this.getApplicationById(id) as Promise<RecalculationApplication>;
  }

  async createSnapshot(applicationId: string, snapshotType: string, data: string): Promise<void> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.runAsync(
      'INSERT INTO recalculation_snapshots (id, application_id, snapshot_type, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, applicationId, snapshotType, data, now]
    );
  }

  async getApplicationById(id: string): Promise<RecalculationApplication | undefined> {
    const row = await this.getAsync<any>(
      'SELECT * FROM recalculation_applications WHERE id = ?',
      [id]
    );
    if (!row) return undefined;
    return this.mapToApplication(row);
  }

  async getApplications(
    filters?: { billingMonth?: string; customerAccount?: string; status?: string },
    limit: number = 100,
    offset: number = 0
  ): Promise<RecalculationApplication[]> {
    let sql = 'SELECT * FROM recalculation_applications WHERE 1=1';
    const params: any[] = [];

    if (filters?.billingMonth) {
      sql += ' AND billing_month = ?';
      params.push(filters.billingMonth);
    }
    if (filters?.customerAccount) {
      sql += ' AND customer_account = ?';
      params.push(filters.customerAccount);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.allAsync<any>(sql, params);
    return Promise.all(rows.map(row => this.mapToApplication(row)));
  }

  async updateStatus(applicationId: string, request: UpdateStatusRequest): Promise<void> {
    const now = new Date().toISOString();
    
    await this.runAsync(
      'UPDATE recalculation_applications SET status = ?, current_approver = ?, updated_at = ? WHERE id = ?',
      [request.status, request.approver, now, applicationId]
    );

    const historyId = uuidv4();
    await this.runAsync(
      `INSERT INTO approval_history (
        id, application_id, status, approver, approver_role, opinion, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [historyId, applicationId, request.status, request.approver, request.approverRole, request.opinion, now]
    );
  }

  async getApprovalHistory(applicationId: string): Promise<ApprovalHistory[]> {
    return this.allAsync<ApprovalHistory>(
      'SELECT * FROM approval_history WHERE application_id = ? ORDER BY created_at DESC',
      [applicationId]
    );
  }

  async getSnapshots(applicationId: string): Promise<RecalculationSnapshot[]> {
    return this.allAsync<RecalculationSnapshot>(
      'SELECT * FROM recalculation_snapshots WHERE application_id = ? ORDER BY created_at DESC',
      [applicationId]
    );
  }

  async markAsFailed(applicationId: string, failureReason: string, processingBasis: string, finalConclusion: string): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `UPDATE recalculation_applications 
       SET status = ?, failure_reason = ?, processing_basis = ?, final_conclusion = ?, updated_at = ? 
       WHERE id = ?`,
      [RecalculationStatus.FAILED, failureReason, processingBasis, finalConclusion, now, applicationId]
    );
    await this.createSnapshot(
      applicationId, 
      'FAILED_PROCESSING', 
      JSON.stringify({ failureReason, processingBasis, finalConclusion, failedAt: now })
    );
  }

  async applyManualCorrection(
    applicationId: string,
    request: ManualCorrectionRequest
  ): Promise<void> {
    const now = new Date().toISOString();
    const appRow = await this.getAsync<any>('SELECT total_original_amount FROM recalculation_applications WHERE id = ?', [applicationId]);
    const totalOriginalAmount = appRow?.total_original_amount ?? 0;
    const totalDifference = request.totalNewAmount - totalOriginalAmount;

    await this.runAsync(
      `UPDATE recalculation_applications 
       SET total_new_amount = ?, total_difference = ?, status = ?, updated_at = ? 
       WHERE id = ?`,
      [request.totalNewAmount, totalDifference, RecalculationStatus.PENDING_APPROVAL, now, applicationId]
    );

    await this.runAsync('DELETE FROM impact_details WHERE application_id = ?', [applicationId]);

    for (const detail of request.impactDetails) {
      const detailId = uuidv4();
      const difference = detail.newAmount - detail.originalAmount;
      await this.runAsync(
        `INSERT INTO impact_details (
          id, application_id, item_code, item_name, original_amount, new_amount, difference, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [detailId, applicationId, detail.itemCode, detail.itemName, detail.originalAmount, detail.newAmount, difference, detail.remarks, now]
      );
    }

    await this.createSnapshot(applicationId, 'PROCESSING_RESULT', JSON.stringify(request));
  }

  async completeApplication(applicationId: string, finalConclusion: string, reportUrl: string): Promise<void> {
    const now = new Date().toISOString();
    await this.runAsync(
      `UPDATE recalculation_applications 
       SET status = ?, final_conclusion = ?, report_url = ?, updated_at = ? 
       WHERE id = ?`,
      [RecalculationStatus.COMPLETED, finalConclusion, reportUrl, now, applicationId]
    );
    await this.createSnapshot(applicationId, 'FINAL_CONCLUSION', JSON.stringify({ finalConclusion, reportUrl }));
  }

  async getAllApplicationsForExport(filters?: { billingMonth?: string; status?: string }): Promise<RecalculationApplication[]> {
    let sql = 'SELECT * FROM recalculation_applications WHERE 1=1';
    const params: any[] = [];

    if (filters?.billingMonth) {
      sql += ' AND billing_month = ?';
      params.push(filters.billingMonth);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.allAsync<any>(sql, params);
    return Promise.all(rows.map(row => this.mapToApplication(row)));
  }

  private mapToImpactDetail(row: any): ImpactDetail {
    return {
      id: row.id,
      itemCode: row.item_code,
      itemName: row.item_name,
      originalAmount: row.original_amount,
      newAmount: row.new_amount,
      difference: row.difference,
      remarks: row.remarks
    };
  }

  private async mapToApplication(row: any): Promise<RecalculationApplication> {
    const impactDetailRows = await this.allAsync<any>(
      'SELECT * FROM impact_details WHERE application_id = ?',
      [row.id]
    );
    const impactDetails = impactDetailRows.map(r => this.mapToImpactDetail(r));

    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      billingMonth: row.billing_month,
      customerAccount: row.customer_account,
      customerName: row.customer_name,
      reasonCategory: row.reason_category,
      reasonDetail: row.reason_detail,
      triggerSource: row.trigger_source,
      totalOriginalAmount: row.total_original_amount,
      totalNewAmount: row.total_new_amount,
      totalDifference: row.total_difference,
      impactDetails,
      status: row.status,
      currentApprover: row.current_approver,
      failureReason: row.failure_reason,
      processingBasis: row.processing_basis,
      finalConclusion: row.final_conclusion,
      reportUrl: row.report_url,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}