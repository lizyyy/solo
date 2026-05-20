"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationController = exports.ReconciliationController = void 0;
const ImportService_1 = require("../services/ImportService");
const ReconciliationEngine_1 = require("../services/ReconciliationEngine");
const ReviewService_1 = require("../services/ReviewService");
const ReportService_1 = require("../services/ReportService");
const DataStore_1 = require("../models/DataStore");
class ReconciliationController {
    async importBedCSV(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ success: false, error: 'filePath is required' });
                return;
            }
            const result = await ImportService_1.importService.importBedCSV(filePath);
            res.json({ success: true, data: result });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async importPatientJSON(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ success: false, error: 'filePath is required' });
                return;
            }
            const result = await ImportService_1.importService.importPatientJSON(filePath);
            res.json({ success: true, data: result });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async importCleaningWorkOrdersJSON(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ success: false, error: 'filePath is required' });
                return;
            }
            const result = await ImportService_1.importService.importCleaningWorkOrdersJSON(filePath);
            res.json({ success: true, data: result });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async runReconciliation(req, res) {
        try {
            const { performedBy, ward } = req.body;
            if (!performedBy) {
                res.status(400).json({ success: false, error: 'performedBy is required' });
                return;
            }
            const record = await ReconciliationEngine_1.reconciliationEngine.runReconciliation(performedBy, ward);
            res.json({ success: true, data: record });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async reviewDiscrepancy(req, res) {
        try {
            const { discrepancyId } = req.params;
            const { result, action, notes, reviewedBy, supportingEvidence } = req.body;
            if (!discrepancyId || !result || !action || !notes || !reviewedBy) {
                res.status(400).json({ success: false, error: 'Missing required fields' });
                return;
            }
            const reviewResult = await ReviewService_1.reviewService.reviewDiscrepancy(discrepancyId, result, action, notes, reviewedBy, supportingEvidence);
            res.json({ success: true, data: reviewResult });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async batchReview(req, res) {
        try {
            const { discrepancyIds, result, action, notes, reviewedBy } = req.body;
            if (!discrepancyIds || !result || !action || !notes || !reviewedBy) {
                res.status(400).json({ success: false, error: 'Missing required fields' });
                return;
            }
            const batchResult = await ReviewService_1.reviewService.batchReview(discrepancyIds, result, action, notes, reviewedBy);
            res.json({ success: true, data: batchResult });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getDiscrepancies(req, res) {
        try {
            const { status, type, severity } = req.query;
            let discrepancies = DataStore_1.dataStore.getAllDiscrepancies();
            if (status === 'resolved') {
                discrepancies = discrepancies.filter(d => d.isResolved);
            }
            else if (status === 'pending') {
                discrepancies = discrepancies.filter(d => !d.isResolved);
            }
            if (type) {
                discrepancies = discrepancies.filter(d => d.type === type);
            }
            if (severity) {
                discrepancies = discrepancies.filter(d => d.severity === severity);
            }
            res.json({ success: true, data: discrepancies, count: discrepancies.length });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getDiscrepancy(req, res) {
        try {
            const { discrepancyId } = req.params;
            const discrepancy = DataStore_1.dataStore.getDiscrepancy(discrepancyId);
            if (!discrepancy) {
                res.status(404).json({ success: false, error: 'Discrepancy not found' });
                return;
            }
            const history = ReviewService_1.reviewService.getDiscrepancyReviewHistory(discrepancyId);
            const explanation = ReviewService_1.reviewService.generateDiscrepancyExplanation(discrepancyId);
            res.json({
                success: true,
                data: {
                    discrepancy,
                    reviewHistory: history,
                    explanation
                }
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getPatientAuditTrail(req, res) {
        try {
            const { patientId } = req.params;
            const auditTrail = ReviewService_1.reviewService.getPatientAuditTrail(patientId);
            if (!auditTrail.patientInfo) {
                res.status(404).json({ success: false, error: 'Patient not found' });
                return;
            }
            res.json({ success: true, data: auditTrail });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getPatientFullReport(req, res) {
        try {
            const { patientId } = req.params;
            const report = ReportService_1.reportService.getPatientFullReport(patientId);
            if (!report.patient) {
                res.status(404).json({ success: false, error: 'Patient not found' });
                return;
            }
            res.json({ success: true, data: report });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async generateReconciliationReport(req, res) {
        try {
            const { recordId } = req.params;
            const report = ReportService_1.reportService.generateReconciliationReport(recordId);
            res.json({ success: true, data: report });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async exportDiscrepanciesCSV(req, res) {
        try {
            const result = ReportService_1.reportService.exportDiscrepanciesToCSV();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.csv);
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async exportBedsCSV(req, res) {
        try {
            const result = ReportService_1.reportService.exportBedsToCSV();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.csv);
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async exportPatientsCSV(req, res) {
        try {
            const result = ReportService_1.reportService.exportPatientsToCSV();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.csv);
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async exportWorkOrdersCSV(req, res) {
        try {
            const result = ReportService_1.reportService.exportWorkOrdersToCSV();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.csv);
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getSummaryStatistics(req, res) {
        try {
            const statistics = ReportService_1.reportService.generateSummaryStatistics();
            res.json({ success: true, data: statistics });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getDashboardData(req, res) {
        try {
            const dashboardData = ReportService_1.reportService.generateDashboardData();
            res.json({ success: true, data: dashboardData });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getBeds(req, res) {
        try {
            const { ward, status } = req.query;
            let beds = DataStore_1.dataStore.getAllBeds();
            if (ward) {
                beds = beds.filter(b => b.ward === ward);
            }
            if (status) {
                beds = beds.filter(b => b.status === status);
            }
            res.json({ success: true, data: beds, count: beds.length });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getPatients(req, res) {
        try {
            const { status, ward } = req.query;
            let patients = DataStore_1.dataStore.getAllPatients();
            if (status) {
                patients = patients.filter(p => p.status === status);
            }
            res.json({ success: true, data: patients, count: patients.length });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getWorkOrders(req, res) {
        try {
            const { status, ward } = req.query;
            let workOrders = DataStore_1.dataStore.getAllWorkOrders();
            if (status) {
                workOrders = workOrders.filter(wo => wo.status === status);
            }
            if (ward) {
                workOrders = workOrders.filter(wo => wo.ward === ward);
            }
            res.json({ success: true, data: workOrders, count: workOrders.length });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getReconciliationRecords(req, res) {
        try {
            const records = DataStore_1.dataStore.getAllReconciliationRecords();
            res.json({ success: true, data: records, count: records.length });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async validateConsistency(req, res) {
        try {
            const result = ImportService_1.importService.validateBedPatientConsistency();
            res.json({ success: true, data: result });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async clearAllData(req, res) {
        try {
            DataStore_1.dataStore.clearAll();
            res.json({ success: true, message: 'All data cleared successfully' });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.ReconciliationController = ReconciliationController;
exports.reconciliationController = new ReconciliationController();
//# sourceMappingURL=ReconciliationController.js.map