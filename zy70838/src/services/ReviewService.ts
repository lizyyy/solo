import { v4 as uuidv4 } from 'uuid';
import { ReviewRecord, ReconciliationResult, Discrepancy } from '../types';
import { store } from '../models/Store';
import { ReconciliationEngine } from './ReconciliationEngine';

export class ReviewService {
  async reviewDiscrepancy(
    discrepancyId: string,
    action: 'confirm' | 'adjust' | 'dismiss',
    reviewer: string,
    comments: string,
    adjustments?: {
      recordType: 'borrow' | 'vehicle' | 'violation';
      recordId: string;
      field: string;
      oldValue: any;
      newValue: any;
    }[]
  ): Promise<{
    success: boolean;
    review: ReviewRecord;
    updatedRecords: any[];
    updatedReports: ReconciliationResult[];
  }> {
    const discrepancy = store.getDiscrepancy(discrepancyId);
    if (!discrepancy) {
      throw new Error(`差异记录 ${discrepancyId} 不存在`);
    }

    const review: ReviewRecord = {
      id: uuidv4(),
      reconciliationId: '',
      discrepancyId,
      action,
      reviewer,
      reviewTime: new Date(),
      comments,
      adjustments: adjustments?.map(a => ({
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue
      }))
    };

    store.addReview(review);

    const updatedRecords: any[] = [];

    if (adjustments && action === 'adjust') {
      for (const adj of adjustments) {
        let updatedRecord: any;
        
        switch (adj.recordType) {
          case 'borrow':
            updatedRecord = store.updateBorrowRecord(adj.recordId, {
              [adj.field]: adj.newValue
            });
            break;
          case 'vehicle':
            updatedRecord = store.updateVehicle(adj.recordId, {
              [adj.field]: adj.newValue
            });
            break;
          case 'violation':
            updatedRecord = store.updateViolation(adj.recordId, {
              [adj.field]: adj.newValue
            });
            break;
        }

        if (updatedRecord) {
          updatedRecords.push(updatedRecord);
        }
      }
    }

    let newStatus: Discrepancy['status'] = 'open';
    if (action === 'confirm' || action === 'adjust') {
      newStatus = 'resolved';
    } else if (action === 'dismiss') {
      newStatus = 'resolved';
    }

    store.updateDiscrepancy(discrepancyId, {
      status: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date(),
      resolution: comments
    });

    const affectedReports = this.updateReportsForDiscrepancy(discrepancyId, newStatus);

    return {
      success: true,
      review,
      updatedRecords,
      updatedReports: affectedReports
    };
  }

  private updateReportsForDiscrepancy(
    discrepancyId: string,
    newStatus: Discrepancy['status']
  ): ReconciliationResult[] {
    const reports = store.getAllReconciliations();
    const updatedReports: ReconciliationResult[] = [];

    for (const report of reports) {
      if (report.discrepancies.includes(discrepancyId)) {
        const resolvedCount = report.discrepancies.filter(dId => {
          const d = store.getDiscrepancy(dId);
          return d?.status === 'resolved';
        }).length;

        const updatedReport = store.updateReconciliation(report.id, {
          summary: {
            ...report.summary,
            resolvedDiscrepancies: resolvedCount
          }
        });

        if (updatedReport) {
          updatedReports.push(updatedReport);
        }
      }
    }

    return updatedReports;
  }

  async recalculateReconciliation(
    periodStart: Date,
    periodEnd: Date,
    regenerateReport: boolean = true
  ): Promise<{
    newDiscrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[];
    summary: any;
    report?: ReconciliationResult;
  }> {
    const engine = new ReconciliationEngine(periodStart, periodEnd);
    const { discrepancies, summary } = await engine.runFullReconciliation();

    let report: ReconciliationResult | undefined;
    if (regenerateReport) {
      report = this.generateReconciliationReport(periodStart, periodEnd, discrepancies);
    }

    return {
      newDiscrepancies: discrepancies,
      summary,
      report
    };
  }

  private generateReconciliationReport(
    periodStart: Date,
    periodEnd: Date,
    discrepancies: Omit<Discrepancy, 'id' | 'detectedAt'>[]
  ): ReconciliationResult {
    const borrowRecords = store.getAllBorrowRecords().filter(r =>
      r.borrowTime >= periodStart && r.borrowTime <= periodEnd
    );
    
    const violations = store.getAllViolations().filter(v =>
      v.violationTime >= periodStart && v.violationTime <= periodEnd
    );

    const savedDiscrepancies = discrepancies.map(d => store.addDiscrepancy(d));

    const overdueCount = discrepancies.filter(d => d.type === 'overdue_return').length;
    const fuelAbnormalities = discrepancies.filter(d => d.type === 'fuel_card_balance').length;
    const unassignedViolations = discrepancies.filter(d => d.type === 'violation_ownership').length;

    const totalFineAmount = violations.reduce((sum, v) => sum + v.fineAmount, 0);
    const resolvedCount = savedDiscrepancies.filter(d => d.status === 'resolved').length;

    const report: ReconciliationResult = {
      id: uuidv4(),
      reconciliationId: `RC-${Date.now()}`,
      period: {
        start: periodStart,
        end: periodEnd
      },
      status: 'draft',
      summary: {
        totalBorrowRecords: borrowRecords.length,
        overdueReturns: overdueCount,
        totalVehicles: store.getAllVehicles().length,
        fuelCardAbnormalities: fuelAbnormalities,
        totalViolations: violations.length,
        unassignedViolations,
        totalDiscrepancies: discrepancies.length,
        resolvedDiscrepancies: resolvedCount,
        totalFineAmount
      },
      discrepancies: savedDiscrepancies.map(d => d.id),
      reviews: [],
      generatedAt: new Date(),
      generatedBy: 'system'
    };

    return store.addReconciliation(report);
  }

  getDiscrepanciesByStatus(status: 'open' | 'reviewed' | 'resolved'): Discrepancy[] {
    return store.getAllDiscrepancies().filter(d => d.status === status);
  }

  getReviewsByDiscrepancy(discrepancyId: string): ReviewRecord[] {
    return store['reviews'] ? 
      Array.from((store['reviews'] as Map<string, ReviewRecord>).values())
        .filter(r => r.discrepancyId === discrepancyId) : 
      [];
  }

  async finalizeReport(reportId: string, finalizedBy: string): Promise<ReconciliationResult> {
    const report = store.getReconciliation(reportId);
    if (!report) {
      throw new Error(`对账报告 ${reportId} 不存在`);
    }

    const updatedReport = store.updateReconciliation(reportId, {
      status: 'finalized',
      finalizedAt: new Date(),
      finalizedBy
    });

    if (!updatedReport) {
      throw new Error('更新报告失败');
    }

    return updatedReport;
  }

  recalculateReportSummary(reportId: string): ReconciliationResult {
    const report = store.getReconciliation(reportId);
    if (!report) {
      throw new Error(`对账报告 ${reportId} 不存在`);
    }

    const discrepancies = report.discrepancies
      .map(id => store.getDiscrepancy(id))
      .filter(Boolean) as Discrepancy[];

    const resolvedCount = discrepancies.filter(d => d.status === 'resolved').length;

    return store.updateReconciliation(reportId, {
      summary: {
        ...report.summary,
        totalDiscrepancies: discrepancies.length,
        resolvedDiscrepancies: resolvedCount
      }
    })!;
  }

  getReportSummary(reportId: string): any {
    this.recalculateReportSummary(reportId);
    
    const report = store.getReconciliation(reportId);
    if (!report) {
      throw new Error(`对账报告 ${reportId} 不存在`);
    }

    const discrepancies = report.discrepancies.map(id => store.getDiscrepancy(id)).filter(Boolean) as Discrepancy[];
    
    return {
      reportInfo: {
        id: report.id,
        reconciliationId: report.reconciliationId,
        period: report.period,
        status: report.status,
        generatedAt: report.generatedAt,
        finalizedAt: report.finalizedAt
      },
      summary: report.summary,
      breakdown: {
        overdueReturns: discrepancies.filter(d => d.type === 'overdue_return').length,
        fuelCardIssues: discrepancies.filter(d => d.type === 'fuel_card_balance').length,
        violationIssues: discrepancies.filter(d => d.type === 'violation_ownership').length,
        mileageIssues: discrepancies.filter(d => d.type === 'mileage_abnormal').length,
        bySeverity: {
          high: discrepancies.filter(d => d.severity === 'high').length,
          medium: discrepancies.filter(d => d.severity === 'medium').length,
          low: discrepancies.filter(d => d.severity === 'low').length
        }
      }
    };
  }
}

export const reviewService = new ReviewService();
