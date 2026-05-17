"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionStorage = void 0;
class CorrectionStorage {
    constructor() {
        this.corrections = new Map();
        this.reports = new Map();
        this.exceptions = new Map();
        this.rollbackPoints = new Map();
    }
    async saveCorrection(correction) {
        this.corrections.set(correction.id, {
            ...correction,
            updatedAt: new Date()
        });
        return this.corrections.get(correction.id);
    }
    async getCorrection(id) {
        return this.corrections.get(id);
    }
    async listCorrections(filters) {
        let results = Array.from(this.corrections.values());
        if (filters?.status) {
            results = results.filter(c => c.status === filters.status);
        }
        if (filters?.applicant) {
            results = results.filter(c => c.applicant === filters.applicant);
        }
        if (filters?.department) {
            results = results.filter(c => c.applicantDepartment === filters.department);
        }
        return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async saveReport(report) {
        this.reports.set(report.id, report);
        return report;
    }
    async getReport(id) {
        return this.reports.get(id);
    }
    async getReportsByCorrection(correctionId) {
        return Array.from(this.reports.values())
            .filter(r => r.correctionId === correctionId)
            .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    }
    async saveException(exception) {
        this.exceptions.set(exception.id, exception);
        return exception;
    }
    async getExceptionsByCorrection(correctionId) {
        return Array.from(this.exceptions.values())
            .filter(e => e.correctionId === correctionId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    async saveRollbackPoint(point) {
        this.rollbackPoints.set(point.id, point);
        return point;
    }
    async getRollbackPointsByCorrection(correctionId) {
        return Array.from(this.rollbackPoints.values())
            .filter(r => r.correctionId === correctionId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
}
exports.correctionStorage = new CorrectionStorage();
//# sourceMappingURL=CorrectionModel.js.map