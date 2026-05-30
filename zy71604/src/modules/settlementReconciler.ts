import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Decimal } from 'decimal.js';
import {
  SettlementRecord,
  CalculationResult,
  ReconciliationIssue,
  SourceReference,
  DividendAnnouncement,
} from '../types/models';
import { isEqual, formatDecimal } from '../utils/numberUtils';
import { parseDate, isSameDate } from '../utils/dateUtils';

export interface ReconciliationInput {
  calculationResult: CalculationResult;
  settlementRecord: SettlementRecord;
  announcement: DividendAnnouncement;
}

export interface ReconciliationSummary {
  totalRecords: number;
  matched: number;
  mismatched: number;
  pending: number;
  criticalIssues: number;
  totalReinvestedShares: Decimal;
  totalTheoreticalShares: Decimal;
  totalDifference: Decimal;
}

export class SettlementReconciler {
  private tolerance: number;

  constructor(tolerance: number = 0.0001) {
    this.tolerance = tolerance;
  }

  public reconcile(
    input: ReconciliationInput
  ): {
    result: CalculationResult;
    issues: ReconciliationIssue[];
  } {
    const { calculationResult, settlementRecord, announcement } = input;
    const issues: ReconciliationIssue[] = [...calculationResult.issues];

    const dateIssues = this.checkSettlementDate(settlementRecord, announcement);
    issues.push(...dateIssues);

    const shareIssues = this.checkReinvestedShares(
      calculationResult.theoreticalReinvestedShares,
      settlementRecord.reinvestedShares,
      announcement,
      [settlementRecord.source, ...calculationResult.sourceReferences]
    );
    issues.push(...shareIssues);

    if (settlementRecord.cashDividend && calculationResult.dividendType === 'reinvestment') {
      issues.push({
        id: uuidv4(),
        type: 'cash_to_reinvest',
        severity: 'error',
        message: '客户选择红利再投资，但实际收到现金分红',
        expectedValue: '0',
        actualValue: settlementRecord.cashDividend.toString(),
        sourceReferences: [settlementRecord.source, ...calculationResult.sourceReferences],
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    if (!settlementRecord.cashDividend && calculationResult.dividendType === 'cash') {
      const expectedCash = calculationResult.totalDividendAmount;
      if (expectedCash.gt(0)) {
        issues.push({
          id: uuidv4(),
          type: 'choice_mismatch',
          severity: 'warning',
          message: '客户选择现金分红，但未收到现金分红记录',
          expectedValue: expectedCash.toString(),
          actualValue: '0',
          sourceReferences: [settlementRecord.source, ...calculationResult.sourceReferences],
          resolved: false,
          createdAt: dayjs().toISOString(),
        });
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');
    
    let status: 'matched' | 'mismatch' | 'pending' = 'matched';
    if (hasErrors) {
      status = 'mismatch';
    } else if (hasWarnings) {
      status = 'mismatch';
    }

    const updatedResult: CalculationResult = {
      ...calculationResult,
      actualReinvestedShares: settlementRecord.reinvestedShares,
      status,
      issues,
      version: calculationResult.version + 1,
    };

    return {
      result: updatedResult,
      issues,
    };
  }

  private checkSettlementDate(
    settlement: SettlementRecord,
    announcement: DividendAnnouncement
  ): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];

    if (!isSameDate(settlement.settlementDate, announcement.paymentDate)) {
      const settleDate = parseDate(settlement.settlementDate);
      const payDate = parseDate(announcement.paymentDate);
      const dayDiff = settleDate.diff(payDate, 'day');

      issues.push({
        id: uuidv4(),
        type: 'date_mismatch',
        severity: Math.abs(dayDiff) > 3 ? 'warning' : 'warning',
        message: `实际到账日期(${settlement.settlementDate})与公告红利发放日(${announcement.paymentDate})不一致，相差${Math.abs(dayDiff)}天`,
        expectedValue: announcement.paymentDate,
        actualValue: settlement.settlementDate,
        sourceReferences: [announcement.source, settlement.source],
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    return issues;
  }

  private checkReinvestedShares(
    theoretical: Decimal,
    actual: Decimal,
    announcement: DividendAnnouncement,
    sources: SourceReference[]
  ): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];

    if (!isEqual(theoretical, actual, this.tolerance)) {
      const diff = actual.sub(theoretical);
      const diffPercent = theoretical.gt(0) 
        ? diff.div(theoretical).mul(100).toFixed(4) 
        : 'N/A';

      issues.push({
        id: uuidv4(),
        type: 'share_rounding',
        severity: diff.abs().gt(0.01) ? 'error' : 'warning',
        message: `再投资份额差异: 理论${formatDecimal(theoretical, announcement.roundingPrecision)}份, 实际${formatDecimal(actual, announcement.roundingPrecision)}份, 差额${formatDecimal(diff, 6)}份(${diffPercent}%)`,
        expectedValue: theoretical.toFixed(announcement.roundingPrecision),
        actualValue: actual.toFixed(announcement.roundingPrecision),
        sourceReferences: sources,
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    return issues;
  }

  public batchReconcile(
    inputs: ReconciliationInput[]
  ): {
    results: CalculationResult[];
    summary: ReconciliationSummary;
  } {
    const results = inputs.map(input => this.reconcile(input).result);

    let totalReinvestedShares = new Decimal(0);
    let totalTheoreticalShares = new Decimal(0);
    let criticalIssues = 0;

    for (const result of results) {
      totalTheoreticalShares = totalTheoreticalShares.add(result.theoreticalReinvestedShares);
      if (result.actualReinvestedShares) {
        totalReinvestedShares = totalReinvestedShares.add(result.actualReinvestedShares);
      }
      criticalIssues += result.issues.filter(i => i.severity === 'error').length;
    }

    const summary: ReconciliationSummary = {
      totalRecords: results.length,
      matched: results.filter(r => r.status === 'matched').length,
      mismatched: results.filter(r => r.status === 'mismatch').length,
      pending: results.filter(r => r.status === 'pending').length,
      criticalIssues,
      totalReinvestedShares,
      totalTheoreticalShares,
      totalDifference: totalReinvestedShares.sub(totalTheoreticalShares),
    };

    return { results, summary };
  }

  public findUnmatchedRecords(
    settlements: SettlementRecord[],
    calculations: CalculationResult[]
  ): {
    unmatchedSettlements: SettlementRecord[];
    unmatchedCalculations: CalculationResult[];
  } {
    const calcKeys = new Set(
      calculations.map(c => `${c.accountId}:${c.announcementId}`)
    );
    const settleKeys = new Set(
      settlements.map(s => `${s.accountId}:${s.announcementId}`)
    );

    const unmatchedSettlements = settlements.filter(
      s => !calcKeys.has(`${s.accountId}:${s.announcementId}`)
    );
    const unmatchedCalculations = calculations.filter(
      c => !settleKeys.has(`${c.accountId}:${c.announcementId}`)
    );

    return { unmatchedSettlements, unmatchedCalculations };
  }

  public groupIssuesByType(issues: ReconciliationIssue[]): Record<string, ReconciliationIssue[]> {
    return issues.reduce((groups, issue) => {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
      return groups;
    }, {} as Record<string, ReconciliationIssue[]>);
  }

  public resolveIssue(issue: ReconciliationIssue, resolution: string): ReconciliationIssue {
    return {
      ...issue,
      resolved: true,
      resolution,
    };
  }
}
