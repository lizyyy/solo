import db from '../db/index.js';
import batchRepository from '../repositories/BatchRepository.js';
import detailRepository from '../repositories/DetailRepository.js';
import snapshotRepository from '../repositories/SnapshotRepository.js';
import currencyDetectionService from './CurrencyDetectionService.js';
import fingerprintService from './FingerprintService.js';
import auditTrailService from './AuditTrailService.js';
import selfCheckService from './SelfCheckService.js';
import type { 
  SettlementBatch, 
  SettlementDetail, 
  ImportRawRow, 
  ImportSource,
  DetailStatus,
  CurrencyReviewDecision 
} from '../../shared/types.js';

export class WorkflowService {
  generateBatchNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INS-${date}-${random}`;
  }

  private updateBatchSummary(batchId: string): void {
    const details = detailRepository.findByBatchId(batchId);
    
    const totalCommissionAmount = details.reduce((sum, d) => sum + d.commissionAmount, 0);
    const totalTaxAmount = details.reduce((sum, d) => sum + (d.taxRate ? d.commissionAmount * d.taxRate : 0), 0);
    const totalNetAmount = details.reduce((sum, d) => sum + d.netAmount, 0);
    const hasMixedCurrency = details.filter(d => d.hasMixedCurrency).length;
    const warningCount = details.filter(d => d.status === 'EXCEPTION' || d.status === 'PENDING_REVIEW').length;

    db.prepare(`
      UPDATE settlement_batches 
      SET total_commission_amount = ?,
          total_tax_amount = ?,
          total_net_amount = ?,
          has_mixed_currency = ?,
          warning_count = ?
      WHERE id = ?
    `).run(totalCommissionAmount, totalTaxAmount, totalNetAmount, hasMixedCurrency, warningCount, batchId);
  }

  calculateTier(amount: number): { level: number; rate: number } {
    if (amount >= 1000000) return { level: 5, rate: 0.95 };
    if (amount >= 500000) return { level: 4, rate: 0.9 };
    if (amount >= 100000) return { level: 3, rate: 0.85 };
    if (amount >= 50000) return { level: 2, rate: 0.8 };
    return { level: 1, rate: 0.75 };
  }

  async step1Import(
    rawRows: ImportRawRow[],
    operator: string,
    importSource: ImportSource,
    fileHash?: string
  ): Promise<SettlementBatch & { details: SettlementDetail[] }> {
    const batchNo = this.generateBatchNo();
    const now = new Date().toISOString();

    const createTransaction = db.transaction(() => {
      const batch = batchRepository.create({
        batchNo,
        importDate: now,
        importOperator: operator,
        totalRecords: rawRows.length,
        exceptionRecords: 0
      });

      const details: SettlementDetail[] = [];
      let exceptionCount = 0;

      for (const row of rawRows) {
        const snapshot = snapshotRepository.create({
          batchId: batch.id,
          originalLineNo: row.lineNo,
          rawContent: JSON.stringify(row),
          importSource,
          fileHash
        });

        const { amount, currencyText } = currencyDetectionService.extractAmount(row.commissionAmount || row.currency);
        const commissionAmount = amount || parseFloat(row.commissionAmount) || 0;
        const currencyDetection = currencyDetectionService.detectMixedCurrency(row.currency || currencyText);
        const tier = this.calculateTier(commissionAmount);
        const fingerprint = fingerprintService.generateRowFingerprint(row);
        const netAmount = commissionAmount * tier.rate;

        let status: DetailStatus = 'PENDING';
        if (currencyDetection.hasMixed) {
          status = 'PENDING_REVIEW';
          exceptionCount++;
        }

        const detail = detailRepository.create({
          batchId: batch.id,
          originalLineNo: row.lineNo,
          originalSnapshotId: snapshot.id,
          policyNo: row.policyNo,
          productName: row.productName || '',
          commissionAmount,
          currency: currencyDetection.normalized || 'UNKNOWN',
          currencyRaw: row.currency || currencyText,
          hasMixedCurrency: currencyDetection.hasMixed,
          netAmount,
          tierLevel: tier.level,
          tierRate: tier.rate,
          dataFingerprint: fingerprint,
          status
        });

        auditTrailService.logCreation(detail.id, batch.id, operator);
        details.push(detail);
      }

      batchRepository.updateCounts(batch.id, rawRows.length, exceptionCount);
      batchRepository.updateStatus(batch.id, 'IMPORTED');
      
      db.prepare(`
        UPDATE settlement_batches 
        SET imported_by = ?, imported_at = ?, source_file = ?, source_type = ?
        WHERE id = ?
      `).run(operator, now, '除权日截图.xlsx', 'SCREENSHOT', batch.id);
      
      this.updateBatchSummary(batch.id);

      return { ...batch, details };
    });

    const result = createTransaction();
    await selfCheckService.runAllChecks(result.id, ['DUPLICATE_IMPORT', 'MIXED_CURRENCY']);
    return result;
  }

  async step2RiskReview(
    batchId: string,
    operator: string,
    updates: Array<{
      detailId: string;
      taxRate?: number;
      taxRateRemark?: string;
      currencyDecision?: CurrencyReviewDecision;
      currencyRemark?: string;
    }>
  ): Promise<{ recalculatedCount: number; results: any[] }> {
    const batch = batchRepository.findById(batchId);
    if (!batch) throw new Error('批次不存在');

    const recalculationResults: any[] = [];

    const updateTransaction = db.transaction(() => {
      for (const update of updates) {
        const detail = detailRepository.findById(update.detailId);
        if (!detail) continue;

        if (update.taxRate !== undefined) {
          const oldTaxRate = detail.taxRate?.toString() || '';
          const newTaxRate = update.taxRate.toString();
          
          detailRepository.updateField(update.detailId, 'taxRate', update.taxRate, operator);
          
          if (update.taxRateRemark) {
            detailRepository.updateField(update.detailId, 'taxRateRemark', update.taxRateRemark, operator);
          }

          auditTrailService.logTaxRateUpdate(
            update.detailId, batchId, operator, oldTaxRate, newTaxRate, update.taxRateRemark
          );

          const newNetAmount = detailRepository.recalculateNetAmount(update.detailId, operator);
          recalculationResults.push({
            detailId: update.detailId,
            policyNo: detail.policyNo,
            oldNetAmount: detail.netAmount,
            newNetAmount,
            taxRate: update.taxRate
          });
        }

        if (update.currencyDecision) {
          const oldStatus = detail.status;
          let newStatus: DetailStatus = oldStatus;

          switch (update.currencyDecision) {
            case 'MARK_EXCEPTION':
              newStatus = 'EXCEPTION';
              break;
            case 'SUBMIT_REVIEW':
              newStatus = 'PENDING_REVIEW';
              break;
            case 'REJECT':
              newStatus = 'REVIEWED';
              break;
          }

          if (oldStatus !== newStatus) {
            detailRepository.updateStatus(update.detailId, newStatus, operator);
            auditTrailService.logStatusChange(
              update.detailId, batchId, operator, oldStatus, newStatus, update.currencyRemark
            );
          }

          auditTrailService.logCurrencyReview(
            update.detailId, batchId, operator, update.currencyDecision, update.currencyRemark
          );
        }
      }

      const counts = detailRepository.countByBatchId(batchId);
      batchRepository.updateCounts(batchId, counts.total, counts.exceptions);
      batchRepository.updateStatus(batchId, 'RISK_REVIEWED', operator);
      
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE settlement_batches 
        SET risk_reviewed_by = ?, risk_reviewed_at = ?
        WHERE id = ?
      `).run(operator, now, batchId);
      
      this.updateBatchSummary(batchId);
    });

    updateTransaction();
    await selfCheckService.runAllChecks(batchId, ['RECALC_AFTER_SUPPLEMENT']);

    return {
      recalculatedCount: recalculationResults.length,
      results: recalculationResults
    };
  }

  async step3AuditUpdate(
    batchId: string,
    operator: string,
    statusUpdates: Array<{ detailId: string; newStatus: DetailStatus; remark?: string }>
  ): Promise<{ updatedCount: number }> {
    const batch = batchRepository.findById(batchId);
    if (!batch) throw new Error('批次不存在');

    let updatedCount = 0;

    const auditTransaction = db.transaction(() => {
      for (const update of statusUpdates) {
        const detail = detailRepository.findById(update.detailId);
        if (!detail) continue;

        if (detail.status !== update.newStatus) {
          detailRepository.updateStatus(update.detailId, update.newStatus, operator);
          auditTrailService.logStatusChange(
            update.detailId, batchId, operator, detail.status, update.newStatus, update.remark
          );
          updatedCount++;
        }
      }

      const counts = detailRepository.countByBatchId(batchId);
      batchRepository.updateCounts(batchId, counts.total, counts.exceptions);
      batchRepository.updateStatus(batchId, 'AUDITED', operator);
      
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE settlement_batches 
        SET audited_by = ?, audited_at = ?
        WHERE id = ?
      `).run(operator, now, batchId);
      
      this.updateBatchSummary(batchId);
    });

    auditTransaction();
    await selfCheckService.runAllChecks(batchId, ['EXPORT_CONSISTENCY']);

    return { updatedCount };
  }

  async completeBatch(batchId: string): Promise<SettlementBatch> {
    const batch = batchRepository.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    
    batchRepository.updateStatus(batchId, 'COMPLETED');
    return batchRepository.findById(batchId)!;
  }

  async recalculateBatch(batchId: string, operator: string): Promise<{ recalculatedCount: number; results: any[] }> {
    const details = detailRepository.findByBatchId(batchId);
    const results: any[] = [];

    for (const detail of details) {
      if (detail.taxRate !== undefined) {
        const oldNet = detail.netAmount;
        const newNet = detailRepository.recalculateNetAmount(detail.id, operator);
        if (Math.abs(oldNet - newNet) > 0.01) {
          results.push({
            detailId: detail.id,
            policyNo: detail.policyNo,
            oldNetAmount: oldNet,
            newNetAmount: newNet
          });
        }
      }
    }

    await selfCheckService.runAllChecks(batchId, ['RECALC_AFTER_SUPPLEMENT', 'EXPORT_CONSISTENCY']);

    return {
      recalculatedCount: results.length,
      results
    };
  }
}

export default new WorkflowService();
