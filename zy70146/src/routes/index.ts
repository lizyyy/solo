import { Router } from 'express';
import { tenantController } from '../controllers/tenantController';
import { serviceController, endpointController } from '../controllers/serviceController';
import { sloController } from '../controllers/sloController';
import { errorSampleController } from '../controllers/errorSampleController';
import { budgetController } from '../controllers/budgetController';
import { freezeController } from '../controllers/freezeController';
import { alertSuppressionController } from '../controllers/alertSuppressionController';
import { reportController } from '../controllers/reportController';
import { processTraceController } from '../controllers/processTraceController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'error-budget-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.post('/tenants', tenantController.create);
router.get('/tenants', tenantController.list);
router.get('/tenants/:id', tenantController.getById);
router.put('/tenants/:id', tenantController.update);
router.delete('/tenants/:id', tenantController.delete);

router.post('/tenants/:tenantId/services', serviceController.create);
router.get('/tenants/:tenantId/services', serviceController.list);
router.get('/services/:id', serviceController.getById);
router.put('/services/:id', serviceController.update);
router.delete('/services/:id', serviceController.delete);

router.post('/services/:serviceId/endpoints', endpointController.create);
router.get('/services/:serviceId/endpoints', endpointController.list);
router.get('/endpoints/:id', endpointController.getById);
router.put('/endpoints/:id', endpointController.update);
router.delete('/endpoints/:id', endpointController.delete);

router.post('/tenants/:tenantId/slo-configs', sloController.create);
router.get('/tenants/:tenantId/slo-configs', sloController.list);
router.get('/slo-configs/:id', sloController.getById);
router.put('/slo-configs/:id', sloController.update);
router.post('/slo-configs/:id/activate', sloController.activate);
router.post('/slo-configs/:id/deactivate', sloController.deactivate);
router.delete('/slo-configs/:id', sloController.delete);

router.post('/tenants/:tenantId/error-samples', errorSampleController.create);
router.get('/tenants/:tenantId/error-samples', errorSampleController.list);
router.get('/tenants/:tenantId/error-samples/pending', errorSampleController.getPendingDeductions);
router.post('/tenants/:tenantId/error-samples/batch-deduct', errorSampleController.batchRecordAndDeduct);
router.get('/error-samples/:id', errorSampleController.getById);

router.get('/slo-configs/:sloConfigId/budget', budgetController.getOrCreate);
router.get('/slo-configs/:sloConfigId/budget/status', budgetController.getStatus);
router.post('/slo-configs/:sloConfigId/budget/deduct/:errorSampleId', budgetController.deductFromBudget);
router.get('/tenants/:tenantId/budgets', budgetController.list);

router.post('/budgets/:budgetId/freeze', freezeController.freeze);
router.post('/budgets/:budgetId/unfreeze', freezeController.unfreeze);
router.get('/tenants/:tenantId/freezes', freezeController.list);
router.get('/budgets/:budgetId/freeze/active', freezeController.getActive);

router.post('/budgets/:budgetId/alert-suppressions', alertSuppressionController.suppress);
router.post('/alert-suppressions/:suppressionId/unsuppress', alertSuppressionController.unsuppress);
router.get('/tenants/:tenantId/alert-suppressions', alertSuppressionController.list);
router.get('/budgets/:budgetId/alert-suppressions/:alertType/check', alertSuppressionController.checkSuppressed);
router.get('/budgets/:budgetId/alert-suppressions/active', alertSuppressionController.getActive);

router.get('/tenants/:tenantId/reports/budget', reportController.generateBudgetReport);
router.get('/tenants/:tenantId/reports/error-trend', reportController.getErrorTrend);
router.get('/tenants/:tenantId/reports/slo-compliance/:sloConfigId', reportController.getSLOCompliance);
router.get('/tenants/:tenantId/reports/process-blockers', reportController.getProcessBlockers);

router.get('/tenants/:tenantId/process-traces', processTraceController.list);
router.get('/process-traces/:id', processTraceController.getById);
router.get('/tenants/:tenantId/process-traces/current-blocker', processTraceController.getCurrentBlocker);
router.get('/process-traces/:traceId/chain', processTraceController.getTraceChain);

export default router;
