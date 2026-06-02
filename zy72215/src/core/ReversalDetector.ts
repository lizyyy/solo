import { TradeRecord, RecordStatus, AuditLog, TailDiffAdjustment, ReviewSource } from '../types';

export class ReversalDetector {
  private static REVERSAL_KEYWORDS = ['已冲正', '冲正', '冲销', 'reverse', 'reversed'];

  static isZeroWithReversal(amount: number, remark: string): boolean {
    const isZero = Math.abs(amount) < 0.001;
    const hasReversalKeyword = this.REVERSAL_KEYWORDS.some(keyword => 
      remark.toLowerCase().includes(keyword.toLowerCase())
    );
    return isZero && hasReversalKeyword;
  }

  static createAuditLog(operator: string, action: string, oldValue?: any, newValue?: any, remark?: string): AuditLog {
    return {
      timestamp: new Date(),
      operator,
      action,
      oldValue,
      newValue,
      remark
    };
  }

  static createTailDiffAdjustment(
    originalLineNumber: number,
    originalAmount: number,
    currentStatus: RecordStatus,
    reviewSource?: ReviewSource,
    custodianPageReference?: string
  ): TailDiffAdjustment {
    return {
      originalLineNumber,
      originalAmount,
      currentStatus,
      reviewSource,
      custodianPageReference
    };
  }

  static determineInitialStatus(amount: number, remark: string): RecordStatus {
    if (this.isZeroWithReversal(amount, remark)) {
      return RecordStatus.ZERO_WITH_REVERSAL;
    }
    return RecordStatus.IMPORTED;
  }
}
