import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import {
  Appeal,
  AppealStatus,
  ReportSnapshot,
  CreateAppealRequest,
  UpdateStatusRequest,
  ManualCorrectionRequest,
  QueryParams,
  CorrectionRecord,
  ExplanationReport
} from '../types';

export class AppealService {
  private parseJson<T = any>(str: string | null | undefined): T | undefined {
    if (!str) return undefined;
    try {
      return JSON.parse(str) as T;
    } catch {
      return undefined;
    }
  }

  private stringifyJson(obj: any): string {
    return JSON.stringify(obj);
  }

  private rowToAppeal(row: any): Appeal {
    return {
      id: row.id,
      reportName: row.report_name,
      snapshotDate: row.snapshot_date,
      snapshotId: row.snapshot_id,
      appellant: row.appellant,
      appellantContact: row.appellant_contact,
      appealReason: row.appeal_reason,
      status: row.status as AppealStatus,
      metricValues: this.parseJson(row.metric_values) || {},
      rawInput: this.parseJson(row.raw_input),
      processingBasis: row.processing_basis,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      assignee: row.assignee,
      comments: this.parseJson(row.comments)
    };
  }

  private rowToSnapshot(row: any): ReportSnapshot {
    return {
      id: row.id,
      reportName: row.report_name,
      snapshotDate: row.snapshot_date,
      metricValues: this.parseJson(row.metric_values) || {},
      rawData: this.parseJson(row.raw_data),
      createdAt: row.created_at
    };
  }

  private rowToCorrection(row: any): CorrectionRecord {
    return {
      id: row.id,
      appealId: row.appeal_id,
      correctedBy: row.corrected_by,
      correctedAt: row.corrected_at,
      originalValues: this.parseJson(row.original_values) || {},
      correctedValues: this.parseJson(row.corrected_values) || {},
      correctionReason: row.correction_reason
    };
  }

  private rowToReport(row: any): ExplanationReport {
    return {
      id: row.id,
      appealId: row.appeal_id,
      content: row.content,
      generatedBy: row.generated_by,
      generatedAt: row.generated_at,
      attachments: this.parseJson(row.attachments)
    };
  }

  async createSnapshot(request: CreateAppealRequest): Promise<ReportSnapshot> {
    const snapshotId = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO report_snapshots (id, report_name, snapshot_date, metric_values, raw_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        snapshotId,
        request.reportName,
        request.snapshotDate,
        this.stringifyJson(request.metricValues),
        request.rawData ? this.stringifyJson(request.rawData) : null,
        now
      ]
    );

    return {
      id: snapshotId,
      reportName: request.reportName,
      snapshotDate: request.snapshotDate,
      metricValues: request.metricValues,
      rawData: request.rawData,
      createdAt: now
    };
  }

  async checkDuplicateAppeal(reportName: string, snapshotDate: string, appellant: string): Promise<Appeal | null> {
    const row = await getOne(
      `SELECT * FROM appeals 
       WHERE report_name = ? AND snapshot_date = ? AND appellant = ? 
       AND status NOT IN ('rejected', 'closed')
       ORDER BY created_at DESC LIMIT 1`,
      [reportName, snapshotDate, appellant]
    );

    return row ? this.rowToAppeal(row) : null;
  }

  async createAppeal(request: CreateAppealRequest): Promise<{ appeal: Appeal; isDuplicate: boolean }> {
    const duplicate = await this.checkDuplicateAppeal(
      request.reportName,
      request.snapshotDate,
      request.appellant
    );

    if (duplicate) {
      return { appeal: duplicate, isDuplicate: true };
    }

    const snapshot = await this.createSnapshot(request);
    const appealId = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO appeals (
        id, report_name, snapshot_date, snapshot_id, appellant, appellant_contact,
        appeal_reason, status, metric_values, raw_input, created_at, updated_at, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appealId,
        request.reportName,
        request.snapshotDate,
        snapshot.id,
        request.appellant,
        request.appellantContact || null,
        request.appealReason,
        AppealStatus.PENDING,
        this.stringifyJson(request.metricValues),
        this.stringifyJson(request),
        now,
        now,
        this.stringifyJson([])
      ]
    );

    const appeal = await this.getAppealById(appealId);
    if (!appeal) {
      throw new Error('Failed to create appeal');
    }

    return { appeal, isDuplicate: false };
  }

  async getAppealById(id: string): Promise<Appeal | undefined> {
    const row = await getOne(`SELECT * FROM appeals WHERE id = ?`, [id]);
    return row ? this.rowToAppeal(row) : undefined;
  }

  async getSnapshotById(id: string): Promise<ReportSnapshot | undefined> {
    const row = await getOne(`SELECT * FROM report_snapshots WHERE id = ?`, [id]);
    return row ? this.rowToSnapshot(row) : undefined;
  }

  async queryAppeals(params: QueryParams): Promise<{ total: number; data: Appeal[] }> {
    let whereClauses: string[] = [];
    let queryParams: any[] = [];

    if (params.reportName) {
      whereClauses.push('report_name = ?');
      queryParams.push(params.reportName);
    }

    if (params.snapshotDate) {
      whereClauses.push('snapshot_date = ?');
      queryParams.push(params.snapshotDate);
    }

    if (params.status) {
      whereClauses.push('status = ?');
      queryParams.push(params.status);
    }

    if (params.appellant) {
      whereClauses.push('appellant LIKE ?');
      queryParams.push(`%${params.appellant}%`);
    }

    if (params.startDate) {
      whereClauses.push('created_at >= ?');
      queryParams.push(params.startDate);
    }

    if (params.endDate) {
      whereClauses.push('created_at <= ?');
      queryParams.push(params.endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM appeals ${whereSql}`,
      queryParams
    );
    const total = countRow?.count || 0;

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const rows = await getAll(
      `SELECT * FROM appeals ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, pageSize, offset]
    );

    return {
      total,
      data: rows.map(row => this.rowToAppeal(row))
    };
  }

  async updateStatus(appealId: string, request: UpdateStatusRequest): Promise<Appeal> {
    const appeal = await this.getAppealById(appealId);
    if (!appeal) {
      throw new Error('Appeal not found');
    }

    const validTransitions: Record<AppealStatus, AppealStatus[]> = {
      [AppealStatus.PENDING]: [AppealStatus.PROCESSING, AppealStatus.REJECTED],
      [AppealStatus.PROCESSING]: [AppealStatus.UNDER_REVIEW, AppealStatus.REJECTED],
      [AppealStatus.UNDER_REVIEW]: [AppealStatus.CORRECTED, AppealStatus.REJECTED],
      [AppealStatus.CORRECTED]: [AppealStatus.CLOSED],
      [AppealStatus.REJECTED]: [AppealStatus.CLOSED],
      [AppealStatus.CLOSED]: []
    };

    if (!validTransitions[appeal.status].includes(request.status)) {
      throw new Error(`Invalid status transition from ${appeal.status} to ${request.status}`);
    }

    const now = new Date().toISOString();
    const comments = appeal.comments || [];
    if (request.comment) {
      comments.push(`[${now}] ${request.operator}: ${request.comment}`);
    }

    await runQuery(
      `UPDATE appeals SET status = ?, updated_at = ?, processing_basis = ?, comments = ? WHERE id = ?`,
      [
        request.status,
        now,
        request.processingBasis || appeal.processingBasis || null,
        this.stringifyJson(comments),
        appealId
      ]
    );

    const updatedAppeal = await this.getAppealById(appealId);
    if (!updatedAppeal) {
      throw new Error('Failed to update appeal status');
    }

    return updatedAppeal;
  }

  async manualCorrection(appealId: string, request: ManualCorrectionRequest): Promise<CorrectionRecord> {
    const appeal = await this.getAppealById(appealId);
    if (!appeal) {
      throw new Error('Appeal not found');
    }

    if (appeal.status !== AppealStatus.UNDER_REVIEW) {
      throw new Error('Correction can only be performed when status is under_review');
    }

    const correctionId = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO correction_records (
        id, appeal_id, corrected_by, corrected_at, original_values, corrected_values, correction_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        correctionId,
        appealId,
        request.correctedBy,
        now,
        this.stringifyJson(appeal.metricValues),
        this.stringifyJson(request.correctedValues),
        request.correctionReason
      ]
    );

    await runQuery(
      `UPDATE appeals SET status = ?, updated_at = ?, metric_values = ? WHERE id = ?`,
      [AppealStatus.CORRECTED, now, this.stringifyJson(request.correctedValues), appealId]
    );

    const row = await getOne(`SELECT * FROM correction_records WHERE id = ?`, [correctionId]);
    if (!row) {
      throw new Error('Failed to create correction record');
    }

    return this.rowToCorrection(row);
  }

  async getCorrectionsByAppealId(appealId: string): Promise<CorrectionRecord[]> {
    const rows = await getAll(`SELECT * FROM correction_records WHERE appeal_id = ? ORDER BY corrected_at DESC`, [appealId]);
    return rows.map(row => this.rowToCorrection(row));
  }

  async generateExplanationReport(appealId: string, generatedBy?: string): Promise<ExplanationReport> {
    const appeal = await this.getAppealById(appealId);
    if (!appeal) {
      throw new Error('Appeal not found');
    }

    const snapshot = await this.getSnapshotById(appeal.snapshotId);
    const corrections = await this.getCorrectionsByAppealId(appealId);

    const reportId = uuidv4();
    const now = new Date().toISOString();

    const content = this.generateReportContent(appeal, snapshot, corrections);

    await runQuery(
      `INSERT INTO explanation_reports (
        id, appeal_id, content, generated_by, generated_at, attachments
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [reportId, appealId, content, generatedBy || null, now, null]
    );

    const row = await getOne(`SELECT * FROM explanation_reports WHERE id = ?`, [reportId]);
    if (!row) {
      throw new Error('Failed to generate explanation report');
    }

    return this.rowToReport(row);
  }

  private generateReportContent(appeal: Appeal, snapshot?: ReportSnapshot, corrections?: CorrectionRecord[]): string {
    let content = `
报表申诉解释报告
================

基本信息
--------
申诉ID: ${appeal.id}
报表名称: ${appeal.reportName}
快照日期: ${appeal.snapshotDate}
申诉人: ${appeal.appellant}
申诉时间: ${appeal.createdAt}
当前状态: ${appeal.status}

申诉原因
--------
${appeal.appealReason}

原始快照数据
------------
`;

    if (snapshot) {
      content += `快照ID: ${snapshot.id}\n`;
      content += `指标值:\n`;
      for (const [key, value] of Object.entries(snapshot.metricValues)) {
        content += `  ${key}: ${value}\n`;
      }
    }

    if (corrections && corrections.length > 0) {
      content += `
修正记录
--------
`;
      corrections.forEach((correction, index) => {
        content += `\n修正 #${index + 1}:\n`;
        content += `修正人: ${correction.correctedBy}\n`;
        content += `修正时间: ${correction.correctedAt}\n`;
        content += `修正原因: ${correction.correctionReason}\n`;
        content += `修正对比:\n`;
        const allKeys = new Set([
          ...Object.keys(correction.originalValues),
          ...Object.keys(correction.correctedValues)
        ]);
        allKeys.forEach(key => {
          const original = correction.originalValues[key];
          const corrected = correction.correctedValues[key];
          const diff = original !== corrected ? ` (差异: ${corrected - original})` : '';
          content += `  ${key}: ${original} -> ${corrected}${diff}\n`;
        });
      });
    }

    if (appeal.processingBasis) {
      content += `
处理依据
--------
${appeal.processingBasis}
`;
    }

    content += `
报告生成时间: ${new Date().toISOString()}
`;

    return content;
  }

  async getReportByAppealId(appealId: string): Promise<ExplanationReport | undefined> {
    const row = await getOne(`SELECT * FROM explanation_reports WHERE appeal_id = ? ORDER BY generated_at DESC LIMIT 1`, [appealId]);
    return row ? this.rowToReport(row) : undefined;
  }

  async exportAppealData(appealId: string): Promise<any> {
    const appeal = await this.getAppealById(appealId);
    if (!appeal) {
      throw new Error('Appeal not found');
    }

    const snapshot = await this.getSnapshotById(appeal.snapshotId);
    const corrections = await this.getCorrectionsByAppealId(appealId);
    const report = await this.getReportByAppealId(appealId);

    return {
      appeal,
      snapshot,
      corrections,
      explanationReport: report,
      exportTime: new Date().toISOString()
    };
  }
}

export const appealService = new AppealService();
