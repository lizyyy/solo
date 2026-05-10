import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import db from '../database/init';
import { QualityReport } from '../types';
import { getRuleVersionById } from './ruleVersionService';
import { logOperation } from './operationLogService';

export interface GenerateReportRequest {
  ruleVersionId: string;
  reportDate?: string;
  generatedBy: string;
}

function mapRowToReport(row: {
  id: string;
  rule_version_id: string;
  report_date: string;
  total_batches: number;
  success_batches: number;
  fail_batches: number;
  average_score: number;
  generated_at: string;
}): QualityReport {
  return {
    id: row.id,
    ruleVersionId: row.rule_version_id,
    reportDate: row.report_date,
    totalBatches: row.total_batches,
    successBatches: row.success_batches,
    failBatches: row.fail_batches,
    averageScore: row.average_score,
    generatedAt: row.generated_at,
  };
}

export async function generateQualityReport(
  request: GenerateReportRequest
): Promise<QualityReport> {
  const ruleVersion = await getRuleVersionById(request.ruleVersionId);
  if (!ruleVersion) {
    throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
  }

  const reportDate = request.reportDate || moment().format('YYYY-MM-DD');
  const now = moment().toISOString();
  const id = uuidv4();

  const stats = await getBatchStatistics(request.ruleVersionId);

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO quality_reports (
        id, rule_version_id, report_date, total_batches, success_batches, 
        fail_batches, average_score, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        request.ruleVersionId,
        reportDate,
        stats.totalBatches,
        stats.successBatches,
        stats.failBatches,
        stats.averageScore,
        now,
      ],
      async (err) => {
        if (err) return reject(err);

        const successRate =
          stats.totalBatches > 0
            ? ((stats.successBatches / stats.totalBatches) * 100).toFixed(2)
            : '0';

        await logOperation(
          'REPORT_GENERATE',
          'QualityReport',
          id,
          `生成质量报表 - 日期: ${reportDate}, 总批次: ${stats.totalBatches}, 成功率: ${successRate}%, 平均得分: ${stats.averageScore}`,
          request.generatedBy,
          {
            metadata: {
              ruleId: ruleVersion.ruleId,
              ruleVersion: ruleVersion.version,
              reportDate,
              totalBatches: stats.totalBatches,
              successBatches: stats.successBatches,
              failBatches: stats.failBatches,
              successRate: Number(successRate),
              averageScore: stats.averageScore,
            },
          }
        );

        db.get(`SELECT * FROM quality_reports WHERE id = ?`, [id], (queryErr, row) => {
          if (queryErr) return reject(queryErr);
          if (!row) return reject(new Error('生成失败'));
          resolve(mapRowToReport(row as never));
        });
      }
    );
  });
}

async function getBatchStatistics(ruleVersionId: string): Promise<{
  totalBatches: number;
  successBatches: number;
  failBatches: number;
  averageScore: number;
}> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number; success: number; fail: number }>(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as fail
         FROM batch_recalculations WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, countResult) => {
          if (err) return reject(err);

          db.get<{ avg_pass_rate: number }>(
            `SELECT AVG(
               CASE WHEN data_count > 0 
               THEN (pass_count * 100.0 / data_count) 
               ELSE 0 
               END
             ) as avg_pass_rate
             FROM batch_recalculations 
             WHERE rule_version_id = ? AND status = 'SUCCESS'`,
            [ruleVersionId],
            (avgErr, avgResult) => {
              if (avgErr) return reject(avgErr);

              resolve({
                totalBatches: countResult?.total || 0,
                successBatches: countResult?.success || 0,
                failBatches: countResult?.fail || 0,
                averageScore: avgResult?.avg_pass_rate || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function getReportById(id: string): Promise<QualityReport | null> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM quality_reports WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(mapRowToReport(row as never));
    });
  });
}

export async function listReportsByRuleVersion(
  ruleVersionId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<{ reports: QualityReport[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM quality_reports WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, countResult) => {
          if (err) return reject(err);

          db.all(
            `SELECT * FROM quality_reports WHERE rule_version_id = ? ORDER BY generated_at DESC LIMIT ? OFFSET ?`,
            [ruleVersionId, pageSize, offset],
            (queryErr, rows) => {
              if (queryErr) return reject(queryErr);
              const reports = (rows as never[]).map((row) => mapRowToReport(row));
              resolve({
                reports,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function getRuleVersionSummary(ruleVersionId: string): Promise<{
  ruleVersion: {
    id: string;
    ruleId: string;
    ruleName: string;
    version: number;
    status: string;
  };
  batchStatistics: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    running: number;
    successRate: string;
    averageScore: string;
  };
  subscriptionCount: number;
  activeSubscriptionCount: number;
  waiveCount: number;
  totalWaivedRows: number;
  reportCount: number;
}> {
  const ruleVersion = await getRuleVersionById(ruleVersionId);
  if (!ruleVersion) {
    throw new Error(`规则版本不存在: ${ruleVersionId}`);
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      let batchStats: {
        total: number;
        success: number;
        failed: number;
        pending: number;
        running: number;
      } = { total: 0, success: 0, failed: 0, pending: 0, running: 0 };
      let avgScore = 0;
      let subscriptionCounts = { total: 0, active: 0 };
      let waiveStats = { count: 0, totalRows: 0 };
      let reportCount = 0;

      db.get<{
        total: number;
        success: number;
        failed: number;
        pending: number;
        running: number;
      }>(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running
         FROM batch_recalculations WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, batchResult) => {
          if (err) return reject(err);
          batchStats = batchResult || batchStats;
        }
      );

      db.get<{ avg_score: number }>(
        `SELECT AVG(
           CASE WHEN data_count > 0 
           THEN (pass_count * 100.0 / data_count) 
           ELSE 0 
           END
         ) as avg_score
         FROM batch_recalculations 
         WHERE rule_version_id = ? AND status = 'SUCCESS'`,
        [ruleVersionId],
        (err, avgResult) => {
          if (err) return reject(err);
          avgScore = avgResult?.avg_score || 0;
        }
      );

      db.get<{ total: number; active: number }>(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active
         FROM alert_subscriptions WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, subResult) => {
          if (err) return reject(err);
          subscriptionCounts = subResult || subscriptionCounts;
        }
      );

      db.get<{ count: number; total_rows: number }>(
        `SELECT 
           COUNT(*) as count,
           SUM(affected_rows) as total_rows
         FROM false_positive_waives WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, waiveResult) => {
          if (err) return reject(err);
          waiveStats = {
            count: waiveResult?.count || 0,
            totalRows: waiveResult?.total_rows || 0,
          };
        }
      );

      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM quality_reports WHERE rule_version_id = ?`,
        [ruleVersionId],
        (err, reportResult) => {
          if (err) return reject(err);
          reportCount = reportResult?.count || 0;

          const successRate =
            batchStats.total > 0
              ? ((batchStats.success / batchStats.total) * 100).toFixed(2)
              : '0';

          resolve({
            ruleVersion: {
              id: ruleVersion.id,
              ruleId: ruleVersion.ruleId,
              ruleName: ruleVersion.ruleName,
              version: ruleVersion.version,
              status: ruleVersion.status,
            },
            batchStatistics: {
              total: batchStats.total,
              success: batchStats.success,
              failed: batchStats.failed,
              pending: batchStats.pending,
              running: batchStats.running,
              successRate,
              averageScore: avgScore.toFixed(2),
            },
            subscriptionCount: subscriptionCounts.total,
            activeSubscriptionCount: subscriptionCounts.active,
            waiveCount: waiveStats.count,
            totalWaivedRows: waiveStats.totalRows,
            reportCount,
          });
        }
      );
    });
  });
}
