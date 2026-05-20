"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationAPI = void 0;
const ImportService_1 = require("./services/ImportService");
const ReconciliationEngine_1 = require("./services/ReconciliationEngine");
const ReviewService_1 = require("./services/ReviewService");
const ReportService_1 = require("./services/ReportService");
class ReconciliationAPI {
    constructor(reconciliationDate) {
        this.importService = new ImportService_1.DataImportService();
        this.engine = new ReconciliationEngine_1.ReconciliationEngine(reconciliationDate);
        this.reviewService = new ReviewService_1.ReviewService(this.engine);
        this.reportService = new ReportService_1.ReportService();
    }
    async importFromFiles(classListPath, healthCheckPath, medicationPath) {
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
    performReconciliation() {
        return this.engine.performReconciliation();
    }
    getResults() {
        return this.engine.getResults();
    }
    getResultsByStatus(status) {
        return this.engine.getResultsByStatus(status);
    }
    getResultById(id) {
        return this.engine.getResultById(id);
    }
    approveResult(resultId, reviewer, notes) {
        return this.reviewService.performReview({
            resultId,
            action: 'APPROVE',
            reviewer,
            notes,
        });
    }
    rejectResult(resultId, reviewer, notes) {
        return this.reviewService.performReview({
            resultId,
            action: 'REJECT',
            reviewer,
            notes,
        });
    }
    requestMoreInfo(resultId, reviewer, notes) {
        return this.reviewService.performReview({
            resultId,
            action: 'REQUEST_INFO',
            reviewer,
            notes,
        });
    }
    modifyResult(resultId, reviewer, modifications) {
        return this.reviewService.performReview({
            resultId,
            action: 'MODIFY',
            reviewer,
            modifications,
        });
    }
    batchApprove(resultIds, reviewer) {
        return this.reviewService.batchApprove(resultIds, reviewer);
    }
    getSummary() {
        return this.reportService.generateSummary(this.engine.getResults());
    }
    exportReportJSON(outputPath, generatedBy) {
        const report = this.reportService.generateExportReport(this.engine.getResults(), generatedBy);
        this.reportService.exportToJSON(report, outputPath);
    }
    exportReportCSV(outputPath) {
        this.reportService.exportToCSV(this.engine.getResults(), outputPath);
    }
    exportReportText(outputPath, generatedBy) {
        const report = this.reportService.generateExportReport(this.engine.getResults(), generatedBy);
        this.reportService.exportTextReport(report, outputPath);
        return this.reportService.generateTextReport(report);
    }
    getTextReport(generatedBy) {
        const report = this.reportService.generateExportReport(this.engine.getResults(), generatedBy);
        return this.reportService.generateTextReport(report);
    }
    getAuditTrail(resultId) {
        const result = this.engine.getResultById(resultId);
        if (!result)
            return null;
        return this.reviewService.getAuditTrail(result);
    }
    getModificationHistory(resultId) {
        const result = this.engine.getResultById(resultId);
        if (!result)
            return null;
        return this.reviewService.getModificationHistory(result);
    }
}
exports.ReconciliationAPI = ReconciliationAPI;
