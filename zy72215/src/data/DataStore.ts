import { TradeRecord, PerformanceReport, RecordStatus } from '../types';

export class DataStore {
  private static instance: DataStore;
  private records: Map<string, TradeRecord> = new Map();

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  addRecord(record: TradeRecord): void {
    this.records.set(record.id, record);
  }

  addRecords(records: TradeRecord[]): void {
    records.forEach(record => this.addRecord(record));
  }

  getRecord(id: string): TradeRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): TradeRecord[] {
    return Array.from(this.records.values());
  }

  getRecordsByStatus(status: RecordStatus): TradeRecord[] {
    return this.getAllRecords().filter(r => r.status === status);
  }

  getZeroWithReversalRecords(): TradeRecord[] {
    return this.getAllRecords().filter(r => r.isZeroWithReversal);
  }

  updateRecord(id: string, updatedRecord: TradeRecord): boolean {
    if (this.records.has(id)) {
      this.records.set(id, updatedRecord);
      return true;
    }
    return false;
  }

  deleteRecord(id: string): boolean {
    return this.records.delete(id);
  }

  clearAll(): void {
    this.records.clear();
  }

  getRecordsByDate(tradeDate: string): TradeRecord[] {
    return this.getAllRecords().filter(r => r.tradeDate === tradeDate);
  }

  getRecordsByTrader(traderId: string): TradeRecord[] {
    return this.getAllRecords().filter(r => r.traderId === traderId);
  }

  getPerformanceReport(reportDate: string): PerformanceReport {
    const records = this.getRecordsByDate(reportDate);
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const pendingReviewRecords = records.filter(r => 
      r.status === RecordStatus.PENDING_REVIEW || 
      r.status === RecordStatus.ZERO_WITH_REVERSAL
    );

    return {
      reportDate,
      records,
      summary: {
        totalRecords: records.length,
        normalRecords: records.filter(r => 
          r.status === RecordStatus.REVIEWED_NORMAL || 
          r.status === RecordStatus.SUMMARIZED
        ).length,
        pendingReviewRecords: pendingReviewRecords.length,
        zeroWithReversalRecords: records.filter(r => r.isZeroWithReversal).length,
        totalAmount
      }
    };
  }

  getSummaryForManager(reportDate: string): {
    reportDate: string;
    totalAmount: number;
    totalRecords: number;
    pendingReviewCount: number;
    traders: { traderId: string; totalAmount: number; recordCount: number }[];
  } {
    const records = this.getRecordsByDate(reportDate).filter(r => 
      r.status !== RecordStatus.ZERO_WITH_REVERSAL
    );
    const traderMap = new Map<string, { totalAmount: number; recordCount: number }>();

    records.forEach(r => {
      const existing = traderMap.get(r.traderId) || { totalAmount: 0, recordCount: 0 };
      traderMap.set(r.traderId, {
        totalAmount: existing.totalAmount + r.amount,
        recordCount: existing.recordCount + 1
      });
    });

    return {
      reportDate,
      totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
      totalRecords: records.length,
      pendingReviewCount: this.getRecordsByDate(reportDate).filter(r => 
        r.status === RecordStatus.PENDING_REVIEW
      ).length,
      traders: Array.from(traderMap.entries()).map(([traderId, data]) => ({
        traderId,
        ...data
      }))
    };
  }
}
