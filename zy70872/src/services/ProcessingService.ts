import moment from 'moment';
import { DataStore } from '../models/DataStore';
import { 
  Showtime, 
  BoxOffice, 
  ProcessingRecord, 
  RecordStatus, 
  BoundaryType, 
  BoundaryLog,
  Contract
} from '../types';

export class ProcessingService {
  private dataStore: DataStore;

  constructor() {
    this.dataStore = DataStore.getInstance();
  }

  public detectCrossDay(showtime: Showtime): boolean {
    const start = moment(showtime.startTime, 'HH:mm');
    const end = moment(showtime.endTime, 'HH:mm');
    return end.isBefore(start) || end.diff(start, 'hours') > 6;
  }

  public createCrossDayLog(showtime: Showtime, handler: string, reason: string): BoundaryLog {
    return {
      type: BoundaryType.CROSS_DAY,
      reason,
      handler,
      timestamp: new Date().toISOString(),
      details: {
        filmName: showtime.filmName,
        hallName: showtime.hallName,
        startTime: showtime.startTime,
        endTime: showtime.endTime,
        date: showtime.date,
        explanation: `场次跨日：${showtime.date} ${showtime.startTime} - ${showtime.endTime}，次日场次需单独核算`
      }
    };
  }

  public calculateSubsidy(boxOffice: BoxOffice, contract: Contract): {
    amount: number;
    isOverLimit: boolean;
    limit: number;
  } {
    const calculatedSubsidy = boxOffice.grossAmount * contract.subsidyRate;
    const isOverLimit = calculatedSubsidy > contract.subsidyMaxAmount;
    
    return {
      amount: isOverLimit ? contract.subsidyMaxAmount : calculatedSubsidy,
      isOverLimit,
      limit: contract.subsidyMaxAmount
    };
  }

  public createSubsidyLimitLog(
    boxOffice: BoxOffice, 
    contract: Contract, 
    handler: string,
    calculatedAmount: number
  ): BoundaryLog {
    return {
      type: BoundaryType.SUBSIDY_LIMIT,
      reason: '补贴金额超出合同约定上限',
      handler,
      timestamp: new Date().toISOString(),
      details: {
        filmName: boxOffice.filmName,
        grossAmount: boxOffice.grossAmount,
        subsidyRate: contract.subsidyRate,
        calculatedAmount,
        maxAmount: contract.subsidyMaxAmount,
        actualAmount: contract.subsidyMaxAmount,
        explanation: `按${(contract.subsidyRate * 100).toFixed(1)}%计算应补贴${calculatedAmount.toFixed(2)}元，超出合同上限${contract.subsidyMaxAmount.toFixed(2)}元，按上限发放`
      }
    };
  }

  public calculateRefundDeduction(boxOffice: BoxOffice, contract: Contract): {
    deductionAmount: number;
    explanation: string;
  } {
    const deductionAmount = boxOffice.refundAmount * contract.refundDeductionRate;
    return {
      deductionAmount,
      explanation: `退票金额${boxOffice.refundAmount.toFixed(2)}元，按${(contract.refundDeductionRate * 100).toFixed(1)}%扣减${deductionAmount.toFixed(2)}元`
    };
  }

  public createRefundDeductionLog(
    boxOffice: BoxOffice,
    contract: Contract,
    handler: string,
    deductionAmount: number
  ): BoundaryLog {
    return {
      type: BoundaryType.REFUND_DEDUCTION,
      reason: '按合同约定进行退票扣减',
      handler,
      timestamp: new Date().toISOString(),
      details: {
        filmName: boxOffice.filmName,
        refundAmount: boxOffice.refundAmount,
        deductionRate: contract.refundDeductionRate,
        deductionAmount,
        explanation: `退票金额${boxOffice.refundAmount.toFixed(2)}元，按${(contract.refundDeductionRate * 100).toFixed(1)}%扣减${deductionAmount.toFixed(2)}元`
      }
    };
  }

  public processShowtimeBatch(
    batchId: string,
    showtimes: Omit<Showtime, 'id' | 'batchId' | 'isCrossDay'>[],
    handler: string
  ): { showtimes: Showtime[]; crossDayCount: number } {
    let crossDayCount = 0;
    const processedShowtimes: Showtime[] = [];

    for (const st of showtimes) {
      const isCrossDay = this.detectCrossDay({
        ...st,
        id: '',
        batchId,
        isCrossDay: false
      } as Showtime);

      if (isCrossDay) {
        crossDayCount++;
      }

      const showtime = this.dataStore.addShowtime({
        ...st,
        batchId,
        isCrossDay
      });
      processedShowtimes.push(showtime);
    }

    this.dataStore.updateBatch(batchId, { showtimeCount: processedShowtimes.length });
    return { showtimes: processedShowtimes, crossDayCount };
  }

  public processBoxOfficeBatch(
    batchId: string,
    boxOffices: Omit<BoxOffice, 'id' | 'batchId'>[],
    handler: string
  ): { boxOffices: BoxOffice[]; records: ProcessingRecord[] } {
    const processedBoxOffices: BoxOffice[] = [];
    const records: ProcessingRecord[] = [];

    for (const bo of boxOffices) {
      const boxOffice = this.dataStore.addBoxOffice({
        ...bo,
        batchId
      });
      processedBoxOffices.push(boxOffice);

      const contract = this.dataStore.getContractByFilm(bo.filmName, bo.date);
      const boundaryLogs: BoundaryLog[] = [];

      if (contract) {
        const subsidyResult = this.calculateSubsidy(boxOffice, contract);
        if (subsidyResult.isOverLimit) {
          const calculatedAmount = boxOffice.grossAmount * contract.subsidyRate;
          boundaryLogs.push(this.createSubsidyLimitLog(boxOffice, contract, handler, calculatedAmount));
        }

        if (boxOffice.refundAmount > 0) {
          const deductionResult = this.calculateRefundDeduction(boxOffice, contract);
          boundaryLogs.push(this.createRefundDeductionLog(boxOffice, contract, handler, deductionResult.deductionAmount));
        }
      }

      const showtimes = this.dataStore.getShowtimesByBatch(batchId)
        .filter(s => s.filmName === bo.filmName);

      for (const showtime of showtimes) {
        if (showtime.isCrossDay) {
          boundaryLogs.push(this.createCrossDayLog(showtime, handler, '系统检测到跨日场次'));
        }

        const record = this.dataStore.createRecord({
          batchId,
          showtimeId: showtime.id,
          boxOfficeId: boxOffice.id,
          contractId: contract?.id,
          filmName: bo.filmName,
          hallName: showtime.hallName,
          date: bo.date,
          status: RecordStatus.PENDING,
          boundaryLogs: [...boundaryLogs],
          currentHandler: handler
        });
        records.push(record);
      }
    }

    this.dataStore.updateBatch(batchId, { 
      boxOfficeCount: processedBoxOffices.length,
      recordCount: records.length
    });

    return { boxOffices: processedBoxOffices, records };
  }

  public approveRecord(recordId: string, handler: string, remarks?: string): ProcessingRecord | undefined {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return undefined;

    return this.dataStore.updateRecord(recordId, {
      status: RecordStatus.APPROVED,
      currentHandler: handler,
      remarks: remarks || record.remarks
    });
  }

  public returnRecord(recordId: string, handler: string, reason: string): ProcessingRecord | undefined {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return undefined;

    return this.dataStore.updateRecord(recordId, {
      status: RecordStatus.RETURNED,
      currentHandler: handler,
      remarks: reason
    });
  }

  public approveBatch(batchId: string, handler: string): ProcessingRecord[] {
    const records = this.dataStore.getRecordsByBatch(batchId);
    const approvedRecords: ProcessingRecord[] = [];

    for (const record of records) {
      const updated = this.approveRecord(record.id, handler);
      if (updated) approvedRecords.push(updated);
    }

    this.dataStore.updateBatch(batchId, {
      status: RecordStatus.APPROVED,
      processedAt: new Date().toISOString(),
      processedBy: handler
    });

    return approvedRecords;
  }

  public getBoundaryExplanation(log: BoundaryLog): string {
    const typeLabels: Record<BoundaryType, string> = {
      [BoundaryType.CROSS_DAY]: '【跨日场次】',
      [BoundaryType.SUBSIDY_LIMIT]: '【补贴上限】',
      [BoundaryType.REFUND_DEDUCTION]: '【退票扣减】'
    };

    return `${typeLabels[log.type]} ${log.details?.explanation || log.reason} (处理人：${log.handler}，时间：${moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss')})`;
  }
}
