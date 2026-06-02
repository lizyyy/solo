import { TradeRecord, RecordStatus, ImportResult } from '../types';
import { ReversalDetector } from './ReversalDetector';

export interface RawTradeRecord {
  tradeDate: string;
  traderId: string;
  instrumentId: string;
  instrumentName: string;
  quantity: number;
  amount: number;
  remark: string;
  originalLineNumber: number;
}

export class TradeRecordFactory {
  private static generateId(): string {
    return `TRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createFromRaw(raw: RawTradeRecord, operator: string): TradeRecord {
    const isZeroWithReversal = ReversalDetector.isZeroWithReversal(raw.amount, raw.remark);
    const initialStatus = ReversalDetector.determineInitialStatus(raw.amount, raw.remark);
    
    const record: TradeRecord = {
      id: this.generateId(),
      tradeDate: raw.tradeDate,
      traderId: raw.traderId,
      instrumentId: raw.instrumentId,
      instrumentName: raw.instrumentName,
      quantity: raw.quantity,
      amount: raw.amount,
      originalAmount: raw.amount,
      remark: raw.remark,
      status: initialStatus,
      isZeroWithReversal,
      auditLogs: [
        ReversalDetector.createAuditLog(
          operator,
          '导入记录',
          undefined,
          { rawData: raw, status: initialStatus },
          isZeroWithReversal ? '检测到金额为0且备注含冲正标识，待人工复核' : '系统自动导入'
        )
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isZeroWithReversal) {
      record.tailDiffAdjustment = ReversalDetector.createTailDiffAdjustment(
        raw.originalLineNumber,
        raw.amount,
        initialStatus
      );
    }

    return record;
  }

  static batchImport(rawRecords: RawTradeRecord[], operator: string): ImportResult {
    const records = rawRecords.map(raw => this.createFromRaw(raw, operator));
    const zeroWithReversalCount = records.filter(r => r.isZeroWithReversal).length;

    return {
      success: true,
      importedCount: records.length,
      zeroWithReversalCount,
      records
    };
  }
}
