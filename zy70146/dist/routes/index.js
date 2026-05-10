"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantController_1 = require("../controllers/tenantController");
const serviceController_1 = require("../controllers/serviceController");
const sloController_1 = require("../controllers/sloController");
const errorSampleController_1 = require("../controllers/errorSampleController");
const budgetController_1 = require("../controllers/budgetController");
const freezeController_1 = require("../controllers/freezeController");
const alertSuppressionController_1 = require("../controllers/alertSuppressionController");
const reportController_1 = require("../controllers/reportController");
const processTraceController_1 = require("../controllers/processTraceController");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        service: 'error-budget-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
router.post('/tenants', tenantController_1.tenantController.create);
router.get('/tenants', tenantController_1.tenantController.list);
router.get('/tenants/:id', tenantController_1.tenantController.getById);
router.put('/tenants/:id', tenantController_1.tenantController.update);
router.delete('/tenants/:id', tenantController_1.tenantController.delete);
router.post('/tenants/:tenantId/services', serviceController_1.serviceController.create);
router.get('/tenants/:tenantId/services', serviceController_1.serviceController.list);
router.get('/services/:id', serviceController_1.serviceController.getById);
router.put('/services/:id', serviceController_1.serviceController.update);
router.delete('/services/:id', serviceController_1.serviceController.delete);
router.post('/services/:serviceId/endpoints', serviceController_1.endpointController.create);
router.get('/services/:serviceId/endpoints', serviceController_1.endpointController.list);
router.get('/endpoints/:id', serviceController_1.endpointController.getById);
router.put('/endpoints/:id', serviceController_1.endpointController.update);
router.delete('/endpoints/:id', serviceController_1.endpointController.delete);
router.post('/tenants/:tenantId/slo-configs', sloController_1.sloController.create);
router.get('/tenants/:tenantId/slo-configs', sloController_1.sloController.list);
router.get('/slo-configs/:id', sloController_1.sloController.getById);
router.put('/slo-configs/:id', sloController_1.sloController.update);
router.post('/slo-configs/:id/activate', sloController_1.sloController.activate);
router.post('/slo-configs/:id/deactivate', sloController_1.sloController.deactivate);
router.delete('/slo-configs/:id', sloController_1.sloController.delete);
router.post('/tenants/:tenantId/error-samples', errorSampleController_1.errorSampleController.create);
router.get('/tenants/:tenantId/error-samples', errorSampleController_1.errorSampleController.list);
router.get('/tenants/:tenantId/error-samples/pending', errorSampleController_1.errorSampleController.getPendingDeductions);
router.post('/tenants/:tenantId/error-samples/batch-deduct', errorSampleController_1.errorSampleController.batchRecordAndDeduct);
router.get('/error-samples/:id', errorSampleController_1.errorSampleController.getById);
router.get('/slo-configs/:sloConfigId/budget', budgetController_1.budgetController.getOrCreate);
router.get('/slo-configs/:sloConfigId/budget/status', budgetController_1.budgetController.getStatus);
router.post('/slo-configs/:sloConfigId/budget/deduct/:errorSampleId', budgetController_1.budgetController.deductFromBudget);
router.get('/tenants/:tenantId/budgets', budgetController_1.budgetController.list);
router.post('/budgets/:budgetId/freeze', freezeController_1.freezeController.freeze);
router.post('/budgets/:budgetId/unfreeze', freezeController_1.freezeController.unfreeze);
router.get('/tenants/:tenantId/freezes', freezeController_1.freezeController.list);
router.get('/budgets/:budgetId/freeze/active', freezeController_1.freezeController.getActive);
router.post('/budgets/:budgetId/alert-suppressions', alertSuppressionController_1.alertSuppressionController.suppress);
router.post('/alert-suppressions/:suppressionId/unsuppress', alertSuppressionController_1.alertSuppressionController.unsuppress);
router.get('/tenants/:tenantId/alert-suppressions', alertSuppressionController_1.alertSuppressionController.list);
router.get('/budgets/:budgetId/alert-suppressions/:alertType/check', alertSuppressionController_1.alertSuppressionController.checkSuppressed);
router.get('/budgets/:budgetId/alert-suppressions/active', alertSuppressionController_1.alertSuppressionController.getActive);
router.get('/tenants/:tenantId/reports/budget', reportController_1.reportController.generateBudgetReport);
router.get('/tenants/:tenantId/reports/error-trend', reportController_1.reportController.getErrorTrend);
router.get('/tenants/:tenantId/reports/slo-compliance/:sloConfigId', reportController_1.reportController.getSLOCompliance);
router.get('/tenants/:tenantId/reports/process-blockers', reportController_1.reportController.getProcessBlockers);
router.get('/tenants/:tenantId/process-traces', processTraceController_1.processTraceController.list);
router.get('/process-traces/:id', processTraceController_1.processTraceController.getById);
router.get('/tenants/:tenantId/process-traces/current-blocker', processTraceController_1.processTraceController.getCurrentBlocker);
router.get('/process-traces/:traceId/chain', processTraceController_1.processTraceController.getTraceChain);
exports.default = router;
//# sourceMappingURL=index.js.map