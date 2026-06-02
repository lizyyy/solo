import type { CreditRecord } from '../../shared/types';
import { unifiedResultRepository } from '../repositories/unifiedResultRepository';

class RecalculationService {
  recalculate(record: CreditRecord): Partial<CreditRecord> {
    const { shareRatio, totalShares } = record.custodianData;
    
    let occupiedAmount = 0;
    if (shareRatio && totalShares) {
      occupiedAmount = Math.round(totalShares * shareRatio * 100);
    }
    
    const availableAmount = record.creditLine - occupiedAmount;

    return {
      occupiedAmount,
      availableAmount
    };
  }

  async supplementAndRecalculate(
    recordId: string,
    supplementFields: Record<string, any>,
    operator: string
  ): Promise<CreditRecord | undefined> {
    const record = unifiedResultRepository.getRecordById(recordId);
    if (!record) return undefined;

    const existingSupplement = record.supplementFields || {};
    const mergedSupplement = { ...existingSupplement, ...supplementFields };

    const custodianUpdates: Partial<CreditRecord['custodianData']> = {};
    if (supplementFields.exDividendDate) {
      custodianUpdates.exDividendDate = supplementFields.exDividendDate;
    }
    if (supplementFields.shareRatio !== undefined) {
      custodianUpdates.shareRatio = supplementFields.shareRatio;
    }
    if (supplementFields.totalShares !== undefined) {
      custodianUpdates.totalShares = supplementFields.totalShares;
    }

    const updatedRecord = {
      ...record,
      supplementFields: mergedSupplement,
      custodianData: {
        ...record.custodianData,
        ...custodianUpdates
      }
    };

    const recalculated = this.recalculate(updatedRecord);

    const updates: Partial<CreditRecord> = {
      supplementFields: mergedSupplement,
      custodianData: updatedRecord.custodianData,
      ...recalculated,
      status: record.nameConsistent ? 'resolved' : 'abnormal',
      reviewStatus: 'pending',
      operator
    };

    unifiedResultRepository.addOperationLog({
      recordId,
      operationType: 'supplement',
      operator,
      operationTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      beforeData: {
        supplementFields: record.supplementFields,
        occupiedAmount: record.occupiedAmount,
        availableAmount: record.availableAmount
      },
      afterData: {
        supplementFields: mergedSupplement,
        ...recalculated
      },
      remark: `补录字段: ${Object.keys(supplementFields).join(', ')}，已自动重算额度`
    });

    return unifiedResultRepository.updateRecord(recordId, updates);
  }
}

export const recalculationService = new RecalculationService();
