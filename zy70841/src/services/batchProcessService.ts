import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import {
  BoothApplication,
  BoothStatus,
  FailureReason,
  ProcessReport,
  SubmissionRecord,
  ValidationResult
} from '../types';
import { store } from '../store/memoryStore';
import { validationService } from './validationService';

export class BatchProcessService {
  async processBatch(
    applications: BoothApplication[],
    batchId: string
  ): Promise<ProcessReport> {
    if (store.isBatchEffective(batchId)) {
      return this.handleDuplicateBatch(applications, batchId);
    }

    const results: ValidationResult[] = [];

    for (const app of applications) {
      store.saveApplication(app);
      const result = validationService.validateApplication(app);
      results.push(result);
    }

    const report = this.generateReport(results, batchId);

    const submissionRecord: SubmissionRecord = {
      batchId,
      applicationIds: applications.map(a => a.id),
      submittedAt: moment().toISOString(),
      processed: true,
      effective: true
    };
    store.saveSubmission(submissionRecord);

    this.updateCalendarForNormalApplications(results);

    return report;
  }

  private handleDuplicateBatch(
    applications: BoothApplication[],
    batchId: string
  ): ProcessReport {
    const results: ValidationResult[] = applications.map(app => ({
      applicationId: app.id,
      boothNumber: app.boothNumber,
      companyName: app.companyName,
      status: BoothStatus.FAILED,
      originalData: {
        boothNumber: app.boothNumber,
        companyName: app.companyName,
        startTime: app.startTime,
        endTime: app.endTime
      },
      issues: [{
        field: 'batchId',
        reason: FailureReason.DUPLICATE_SUBMISSION,
        message: '该批次材料已提交并生效，重复提交无效',
        currentValue: batchId
      }],
      suggestions: ['如需要修改，请先撤销原批次或提交新的批次'],
      processedAt: moment().toISOString(),
      traceId: uuidv4()
    }));

    return this.generateReport(results, batchId);
  }

  private generateReport(results: ValidationResult[], batchId: string): ProcessReport {
    const normalCount = results.filter(r => r.status === BoothStatus.NORMAL).length;
    const pendingCount = results.filter(r => r.status === BoothStatus.PENDING).length;
    const failedCount = results.filter(r => r.status === BoothStatus.FAILED).length;

    const report: ProcessReport = {
      reportId: uuidv4(),
      batchId,
      totalCount: results.length,
      normalCount,
      pendingCount,
      failedCount,
      results,
      generatedAt: moment().toISOString()
    };

    store.saveReport(report);
    return report;
  }

  private updateCalendarForNormalApplications(results: ValidationResult[]): void {
    const normalResults = results.filter(r => r.status === BoothStatus.NORMAL);

    for (const result of normalResults) {
      const application = store.getApplication(result.applicationId);
      if (application) {
        store.saveCalendarEvent({
          id: uuidv4(),
          boothNumber: application.boothNumber,
          startTime: application.startTime,
          endTime: application.endTime,
          companyName: application.companyName,
          status: 'confirmed'
        });
      }
    }
  }

  getReportById(reportId: string): ProcessReport | undefined {
    return store.getReport(reportId);
  }

  getReportByBatch(batchId: string): ProcessReport | undefined {
    return store.getReportByBatch(batchId);
  }

  getTraceDetail(traceId: string): { result: ValidationResult | undefined; report: ProcessReport | undefined } {
    const allReports = store.getAllReports();
    
    for (const report of allReports) {
      const result = report.results.find(r => r.traceId === traceId);
      if (result) {
        return { result, report };
      }
    }
    
    return { result: undefined, report: undefined };
  }

  getApplicationTrace(applicationId: string): {
    application: BoothApplication | undefined;
    result: ValidationResult | undefined;
    report: ProcessReport | undefined;
  } {
    const application = store.getApplication(applicationId);
    
    if (!application) {
      return { application: undefined, result: undefined, report: undefined };
    }

    const allReports = store.getAllReports();
    
    for (const report of allReports) {
      const result = report.results.find(r => r.applicationId === applicationId);
      if (result) {
        return { application, result, report };
      }
    }

    return { application, result: undefined, report: undefined };
  }

  getAllReports(): ProcessReport[] {
    return store.getAllReports();
  }
}

export const batchProcessService = new BatchProcessService();
