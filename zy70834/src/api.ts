import { DataImportService } from './services/ImportService';
import { ReconciliationEngine } from './services/ReconciliationEngine';
import { ReviewService } from './services/ReviewService';
import { ReportService } from './services/ReportService';
import { ReconciliationResult } from './types';
import { formatDate } from './utils/date';

export class ReconciliationAPI {
  private importService: DataImportService;
  private engine: ReconciliationEngine;
  private reviewService: ReviewService;
  private reportService: ReportService;

  constructor(reconciliationDate?: string) {
    this.importService = new DataImportService();
    this.engine = new ReconciliationEngine(reconciliationDate);
    this.reviewService = new ReviewService(this.engine);
    this.reportService = new ReportService();
  }

  async importFromFiles(
    classListPath: string, healthCheckPath: string, medicationPath: string): Promise<{
      students: number;
      healthChecks: number;
      medications: number;
    }> {
    const [students, healthChecks, medications] = await Promise.all([
      this.importService.importClassListCSV(classListPath),
      this.importService.importHealthCheckCSV(healthCheckPath),
      this.importService.importMedicationJSON(medicationPath),
    ]);

    const validatedHealthChecks = this.importService.validateHealthCheckRecords(healthChecks);
    const validatedMedications = this.importService.validateMedicationAuthorizations(medications);

    this.engine.loadData(students, validatedHealthChecks.valid, validatedMedications.valid);

    return {
      students: students.length,
      healthChecks: validatedHealthChecks.valid.length,
      medications: validatedMedications.valid.length,
    };
  }

  performReconciliation(): ReconciliationResult[] {
    return this.engine.performReconciliation();
  }

  getResults(): ReconciliationResult[] {
    return this.engine.getResults();
  }

  getResultsByStatus(status: any): ReconciliationResult[] {
    return this.engine.getResultsByStatus(status);
  }

  getResultById(id: string): ReconciliationResult | undefined {
    return this.engine.getResultById(id);
  }

  approveResult(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null {
    return this.reviewService.performReview({
      resultId,
      action: 'APPROVE',
      reviewer,
      notes,
    });
  }

  rejectResult(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null {
    return this.reviewService.performReview({
      resultId,
      action: 'REJECT',
      reviewer,
      notes,
    });
  }

  requestMoreInfo(resultId: string, reviewer: string, notes?: string): ReconciliationResult | null {
    return this.reviewService.performReview({
      resultId,
      action: 'REQUEST_INFO',
      reviewer,
      notes,
    });
  }

  modifyResult(
    resultId: string,
    reviewer: string,
    modifications: { field: string; oldValue: any; newValue: any; reason: string }[]
  ): ReconciliationResult | null {
    return this.reviewService.performReview({
      resultId,
      action: 'MODIFY',
      reviewer,
      modifications,
    });
  }

  batchApprove(resultIds: string[], reviewer: string): ReconciliationResult[] {
    return this.reviewService.batchApprove(resultIds, reviewer);
  }

  getSummary() {
    return this.reportService.generateSummary(this.engine.getResults());
  }

  exportReportJSON(outputPath: string, generatedBy: string): void {
    const report = this.reportService.generateExportReport(
      this.engine.getResults(),
      generatedBy
    );
    this.reportService.exportToJSON(report, outputPath);
  }

  exportReportCSV(outputPath: string): void {
    this.reportService.exportToCSV(this.engine.getResults(), outputPath);
  }

  exportReportText(outputPath: string, generatedBy: string): string {
    const report = this.reportService.generateExportReport(
      this.engine.getResults(),
      generatedBy
    );
    this.reportService.exportTextReport(report, outputPath);
    return this.reportService.generateTextReport(report);
  }

  getTextReport(generatedBy: string): string {
    const report = this.reportService.generateExportReport(
      this.engine.getResults(),
      generatedBy
    );
    return this.reportService.generateTextReport(report);
  }

  getAuditTrail(resultId: string) {
    const result = this.engine.getResultById(resultId);
    if (!result) return null;
    return this.reviewService.getAuditTrail(result);
  }

  getModificationHistory(resultId: string) {
    const result = this.engine.getResultById(resultId);
    if (!result) return null;
    return this.reviewService.getModificationHistory(result);
  }
}