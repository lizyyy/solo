import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Decimal } from 'decimal.js';
import {
  CalculationResult,
  DividendAnnouncement,
  ShareRecord,
  DividendChoice,
  ReconciliationIssue,
  SourceReference,
  DividendType,
} from '../types/models';
import { roundDecimal, isEqual } from '../utils/numberUtils';
import { parseDate, isSameDate } from '../utils/dateUtils';

export interface CalculationInput {
  accountId: string;
  fundId: string;
  announcement: DividendAnnouncement;
  shareRecord: ShareRecord;
  dividendChoice: DividendChoice;
  actualReinvestedShares?: Decimal;
  sourceReferences?: SourceReference[];
}

export interface CalculationOptions {
  tolerance?: number;
  enableDateCrossCheck?: boolean;
  enableRoundingTrace?: boolean;
}

export class ShareCalculator {
  private defaultOptions: CalculationOptions = {
    tolerance: 0.0001,
    enableDateCrossCheck: true,
    enableRoundingTrace: true,
  };

  public calculate(
    input: CalculationInput,
    options?: CalculationOptions
  ): CalculationResult {
    const opts = { ...this.defaultOptions, ...options };
    const issues: ReconciliationIssue[] = [];
    const { announcement, shareRecord, dividendChoice } = input;

    if (opts.enableDateCrossCheck) {
      const dateIssues = this.checkDateAlignment(announcement, shareRecord);
      issues.push(...dateIssues);
    }

    const sharesOnRecordDate = shareRecord.totalShares;

    const totalDividendAmount = sharesOnRecordDate.mul(announcement.dividendPerUnit);

    let theoreticalReinvestedShares = new Decimal(0);
    let roundingDifference = new Decimal(0);

    if (dividendChoice.dividendType === 'reinvestment') {
      const rawShares = totalDividendAmount.div(announcement.reinvestmentNav);
      
      theoreticalReinvestedShares = roundDecimal(
        rawShares,
        announcement.roundingPrecision,
        announcement.roundingMethod
      );

      if (opts.enableRoundingTrace) {
        roundingDifference = theoreticalReinvestedShares.sub(rawShares);
        
        if (!roundingDifference.isZero()) {
          issues.push(this.createRoundingIssue(
            rawShares,
            theoreticalReinvestedShares,
            announcement,
            [shareRecord.source, dividendChoice.source]
          ));
        }
      }
    }

    let status: 'matched' | 'mismatch' | 'pending' = 'pending';
    if (input.actualReinvestedShares) {
      status = this.compareShares(
        theoreticalReinvestedShares,
        input.actualReinvestedShares,
        opts.tolerance || 0
      );

      if (status === 'mismatch') {
        issues.push(this.createMismatchIssue(
          theoreticalReinvestedShares,
          input.actualReinvestedShares,
          announcement,
          input.sourceReferences || []
        ));
      }
    }

    if (dividendChoice.dividendType === 'reinvestment' && 
        input.actualReinvestedShares && 
        input.actualReinvestedShares.isZero()) {
      issues.push({
        id: uuidv4(),
        type: 'cash_to_reinvest',
        severity: 'error',
        message: '客户选择红利再投资，但实际到账份额为0，可能被误转为现金分红',
        expectedValue: theoreticalReinvestedShares.toString(),
        actualValue: '0',
        sourceReferences: [dividendChoice.source, ...(input.sourceReferences || [])],
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    if (dividendChoice.dividendType === 'cash' && 
        input.actualReinvestedShares && 
        input.actualReinvestedShares.gt(0)) {
      issues.push({
        id: uuidv4(),
        type: 'choice_mismatch',
        severity: 'warning',
        message: '客户选择现金分红，但实际有再投资份额到账',
        expectedValue: '0',
        actualValue: input.actualReinvestedShares.toString(),
        sourceReferences: [dividendChoice.source, ...(input.sourceReferences || [])],
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    return {
      id: uuidv4(),
      accountId: input.accountId,
      fundId: input.fundId,
      announcementId: announcement.id,
      registrationDate: announcement.registrationDate,
      sharesOnRecordDate,
      dividendType: dividendChoice.dividendType,
      dividendPerUnit: announcement.dividendPerUnit,
      totalDividendAmount,
      reinvestmentNav: announcement.reinvestmentNav,
      theoreticalReinvestedShares,
      actualReinvestedShares: input.actualReinvestedShares,
      roundingDifference,
      status,
      issues,
      sourceReferences: input.sourceReferences || [shareRecord.source, dividendChoice.source],
      calculatedAt: dayjs().toISOString(),
      version: 1,
    };
  }

  private checkDateAlignment(
    announcement: DividendAnnouncement,
    shareRecord: ShareRecord
  ): ReconciliationIssue[] {
    const issues: ReconciliationIssue[] = [];

    if (!isSameDate(shareRecord.referenceDate, announcement.registrationDate)) {
      const shareDate = parseDate(shareRecord.referenceDate);
      const regDate = parseDate(announcement.registrationDate);
      const dayDiff = shareDate.diff(regDate, 'day');

      issues.push({
        id: uuidv4(),
        type: 'date_mismatch',
        severity: Math.abs(dayDiff) > 1 ? 'error' : 'warning',
        message: `份额基准日期(${shareRecord.referenceDate})与权益登记日(${announcement.registrationDate})不一致，相差${Math.abs(dayDiff)}天`,
        expectedValue: announcement.registrationDate,
        actualValue: shareRecord.referenceDate,
        sourceReferences: [announcement.source, shareRecord.source],
        resolved: false,
        createdAt: dayjs().toISOString(),
      });
    }

    return issues;
  }

  private createRoundingIssue(
    rawValue: Decimal,
    roundedValue: Decimal,
    announcement: DividendAnnouncement,
    sources: SourceReference[]
  ): ReconciliationIssue {
    const diff = roundedValue.sub(rawValue);
    const methodName = {
      'round_half_up': '四舍五入',
      'truncate': '截断',
      'bankers': '银行家舍入',
    }[announcement.roundingMethod];

    return {
      id: uuidv4(),
      type: 'share_rounding',
      severity: 'warning',
      message: `份额计算发生${methodName}处理，原始值: ${rawValue.toFixed(8)}，舍入后: ${roundedValue.toFixed(announcement.roundingPrecision)}，差异: ${diff.toFixed(8)}`,
      expectedValue: rawValue.toFixed(8),
      actualValue: roundedValue.toFixed(announcement.roundingPrecision),
      sourceReferences: sources,
      resolved: false,
      createdAt: dayjs().toISOString(),
    };
  }

  private createMismatchIssue(
    expected: Decimal,
    actual: Decimal,
    announcement: DividendAnnouncement,
    sources: SourceReference[]
  ): ReconciliationIssue {
    const diff = actual.sub(expected);
    return {
      id: uuidv4(),
      type: 'share_rounding',
      severity: diff.abs().gt(0.01) ? 'error' : 'warning',
      message: `理论再投资份额与实际到账不一致，差异: ${diff.toFixed(announcement.roundingPrecision)}`,
      expectedValue: expected.toFixed(announcement.roundingPrecision),
      actualValue: actual.toFixed(announcement.roundingPrecision),
      sourceReferences: sources,
      resolved: false,
      createdAt: dayjs().toISOString(),
    };
  }

  private compareShares(
    theoretical: Decimal,
    actual: Decimal,
    tolerance: number
  ): 'matched' | 'mismatch' {
    return isEqual(theoretical, actual, tolerance) ? 'matched' : 'mismatch';
  }

  public recalculateWithAdjustment(
    previousResult: CalculationResult,
    adjustments: {
      sharesOnRecordDate?: Decimal;
      dividendPerUnit?: Decimal;
      reinvestmentNav?: Decimal;
      dividendType?: DividendType;
    }
  ): CalculationResult {
    const sharesOnRecordDate = adjustments.sharesOnRecordDate || previousResult.sharesOnRecordDate;
    const dividendPerUnit = adjustments.dividendPerUnit || previousResult.dividendPerUnit;
    const reinvestmentNav = adjustments.reinvestmentNav || previousResult.reinvestmentNav;
    const dividendType = adjustments.dividendType || previousResult.dividendType;

    const totalDividendAmount = sharesOnRecordDate.mul(dividendPerUnit);
    let theoreticalReinvestedShares = new Decimal(0);

    if (dividendType === 'reinvestment') {
      theoreticalReinvestedShares = totalDividendAmount.div(reinvestmentNav);
    }

    const roundingDifference = previousResult.actualReinvestedShares
      ? previousResult.actualReinvestedShares.sub(theoreticalReinvestedShares)
      : new Decimal(0);

    return {
      ...previousResult,
      sharesOnRecordDate,
      dividendPerUnit,
      totalDividendAmount,
      reinvestmentNav,
      dividendType,
      theoreticalReinvestedShares,
      roundingDifference,
      calculatedAt: dayjs().toISOString(),
      version: previousResult.version + 1,
    };
  }

  public batchCalculate(
    inputs: CalculationInput[],
    options?: CalculationOptions
  ): {
    results: CalculationResult[];
    summary: {
      total: number;
      matched: number;
      mismatch: number;
      pending: number;
      issues: ReconciliationIssue[];
    };
  } {
    const results = inputs.map(input => this.calculate(input, options));
    
    const matched = results.filter(r => r.status === 'matched').length;
    const mismatch = results.filter(r => r.status === 'mismatch').length;
    const pending = results.filter(r => r.status === 'pending').length;
    
    const allIssues = results.flatMap(r => r.issues);

    return {
      results,
      summary: {
        total: results.length,
        matched,
        mismatch,
        pending,
        issues: allIssues,
      },
    };
  }
}
