"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SettlementFacade_1 = require("../services/SettlementFacade");
const router = (0, express_1.Router)();
router.get('/applications', (req, res) => {
    try {
        const filter = req.query;
        const applications = SettlementFacade_1.settlementFacade.listApplications(filter);
        res.json({ success: true, data: applications });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/applications/:id', (req, res) => {
    try {
        const application = SettlementFacade_1.settlementFacade.getApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ success: false, message: '申请不存在' });
        }
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/applications/:id/history', (req, res) => {
    try {
        const history = SettlementFacade_1.settlementFacade.getHistory(req.params.id);
        res.json({ success: true, data: history });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/applications', (req, res) => {
    try {
        const { contractNo, applicant, settlementReason, operator, expectedSettlementDate } = req.body;
        const application = SettlementFacade_1.settlementFacade.createSettlementApplication(contractNo, applicant, settlementReason, operator, expectedSettlementDate);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.post('/applications/:id/recalculate', (req, res) => {
    try {
        const { operator } = req.body;
        const application = SettlementFacade_1.settlementFacade.recalculateSettlement(req.params.id, operator);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.post('/applications/:id/correct', (req, res) => {
    try {
        const { fieldName, correctedValue, correctedBy, correctionReason } = req.body;
        const application = SettlementFacade_1.settlementFacade.correctValue(req.params.id, fieldName, correctedValue, correctedBy, correctionReason);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.post('/applications/:id/transition', (req, res) => {
    try {
        const { targetStatus, userRole, operator, remark } = req.body;
        const application = SettlementFacade_1.settlementFacade.transitionStatus(req.params.id, targetStatus, userRole, operator, remark);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.post('/applications/:id/remark', (req, res) => {
    try {
        const { remark, operator } = req.body;
        const application = SettlementFacade_1.settlementFacade.updateRemark(req.params.id, remark, operator);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.post('/applications/:id/resolve-anomaly', (req, res) => {
    try {
        const { anomalyType, resolvedBy, resolveReason } = req.body;
        const application = SettlementFacade_1.settlementFacade.resolveAnomaly(req.params.id, anomalyType, resolvedBy, resolveReason);
        res.json({ success: true, data: application });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.get('/applications/:id/report', (req, res) => {
    try {
        const report = SettlementFacade_1.settlementFacade.exportDetailedReport(req.params.id);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.txt"`);
        res.send(report);
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/applications/export', (req, res) => {
    try {
        const { filter, options } = req.body;
        const result = SettlementFacade_1.settlementFacade.exportApplications(filter, options);
        if (options.format === 'CSV') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
            res.send('\uFEFF' + result);
        }
        else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="applications.xlsx"');
            res.send(result);
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/statements', (req, res) => {
    try {
        const { applicationId, createdBy } = req.body;
        const statement = SettlementFacade_1.settlementFacade.createStatement(applicationId, createdBy);
        res.json({ success: true, data: statement });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
router.get('/transitions', (req, res) => {
    try {
        const { status, userRole } = req.query;
        const transitions = SettlementFacade_1.settlementFacade.getAvailableTransitions(status, userRole);
        res.json({ success: true, data: transitions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=routes.js.map