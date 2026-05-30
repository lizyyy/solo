import {
  BatchReport,
  ReportContent,
  ForwardContract,
  RolloverApplication,
  PaymentRecord,
  HistoryRecord,
  ValidationError,
} from '../types';
import { generateBatchNo, generateReportFileName, generateId } from '../utils/formatters';
import dayjs from 'dayjs';

export class ReportService {
  private static reports: BatchReport[] = [];

  static generateReport(
    period: [Date, Date],
    contracts: ForwardContract[],
    rolloverApps: RolloverApplication[],
    payments: PaymentRecord[],
    errors: ValidationError[],
    history: HistoryRecord[],
    createdBy: string
  ): BatchReport {
    const batchNo = generateBatchNo();
    const filteredContracts = this.filterByPeriod(contracts, period);
    const filteredErrors = this.filterErrorsByPeriod(errors, period);
    const filteredHistory = this.filterHistoryByPeriod(history, period);

    const rolloverCount = filteredContracts.filter(c => c.status === 'rolled').length;
    const errorCount = filteredErrors.filter(e => e.severity === 'error').length;
    const warningCount = filteredErrors.filter(e => e.severity === 'warning').length;
    const totalValidations = rolloverCount * 3;
    const passRate = totalValidations > 0
      ? Math.max(0, (totalValidations - errorCount - warningCount) / totalValidations * 100)
      : 100;

    const coverageRate = this.calculateCoverageRate(filteredContracts, rolloverApps);
    const matchAccuracy = this.calculateMatchAccuracy(payments);

    const content: ReportContent = {
      summary: {
        totalContracts: filteredContracts.length,
        rolloverCount,
        errorCount,
        warningCount,
        passRate,
        coverageRate,
        matchAccuracy,
      },
      contractDetails: filteredContracts,
      validationErrors: filteredErrors,
      operationHistory: filteredHistory,
      watermark: batchNo,
    };

    const report: BatchReport = {
      id: generateId(),
      batchNo,
      period,
      createdAt: new Date(),
      createdBy,
      contractCount: filteredContracts.length,
      rolloverCount,
      errorCount,
      warningCount,
      passRate,
      fileName: generateReportFileName(batchNo),
      content,
    };

    this.reports.push(report);
    return report;
  }

  static getReports(): BatchReport[] {
    return [...this.reports].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static getReportByBatchNo(batchNo: string): BatchReport | undefined {
    return this.reports.find(r => r.batchNo === batchNo);
  }

  static exportToExcel(report: BatchReport): void {
    console.log(`导出报告: ${report.fileName}`);
    console.log(`批次号: ${report.batchNo}`);
    console.log(`合约数量: ${report.contractCount}`);
    console.log(`展期数量: ${report.rolloverCount}`);
    console.log(`错误数量: ${report.errorCount}`);
    console.log(`警告数量: ${report.warningCount}`);
    console.log(`通过率: ${report.passRate.toFixed(2)}%`);
  }

  private static filterByPeriod(
    contracts: ForwardContract[],
    period: [Date, Date]
  ): ForwardContract[] {
    const [start, end] = period;
    return contracts.filter(c =>
      dayjs(c.tradeDate).isAfter(start) && dayjs(c.tradeDate).isBefore(end)
    );
  }

  private static filterErrorsByPeriod(
    errors: ValidationError[],
    period: [Date, Date]
  ): ValidationError[] {
    const [start, end] = period;
    return errors.filter(e =>
      dayjs(e.timestamp).isAfter(start) && dayjs(e.timestamp).isBefore(end)
    );
  }

  private static filterHistoryByPeriod(
    history: HistoryRecord[],
    period: [Date, Date]
  ): HistoryRecord[] {
    const [start, end] = period;
    return history.filter(h =>
      dayjs(h.timestamp).isAfter(start) && dayjs(h.timestamp).isBefore(end)
    );
  }

  private static calculateCoverageRate(
    contracts: ForwardContract[],
    applications: RolloverApplication[]
  ): number {
    const rolledContracts = contracts.filter(c => c.status === 'rolled');
    if (rolledContracts.length === 0) return 100;

    let coveredAmount = 0;
    let totalAmount = 0;

    for (const contract of rolledContracts) {
      const app = applications.find(a => a.originalContractId === contract.id);
      const newContract = app?.newContractId
        ? contracts.find(c => c.id === app.newContractId)
        : null;
      if (newContract) {
        coveredAmount += Math.min(newContract.notionalAmount, contract.notionalAmount);
      }
      totalAmount += contract.notionalAmount;
    }

    return totalAmount > 0 ? (coveredAmount / totalAmount) * 100 : 100;
  }

  private static calculateMatchAccuracy(payments: PaymentRecord[]): number {
    if (payments.length === 0) return 100;
    const correctMatches = payments.filter(p => p.matchedStatus === 'matched').length;
    return (correctMatches / payments.length) * 100;
  }
}
