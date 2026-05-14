const express = require('express');
const router = express.Router();
const QuotaController = require('../controllers/QuotaController');

router.post('/call', QuotaController.processCall);
router.post('/retry', QuotaController.retryCall);
router.post('/review', QuotaController.reviewCall);
router.post('/recalculate', QuotaController.recalculateRecords);
router.get('/statistics', QuotaController.getStatistics);
router.get('/billing/export', QuotaController.exportBilling);
router.get('/trend/daily', QuotaController.getDailyTrend);

router.get('/customers', QuotaController.getCustomers);
router.post('/customers', QuotaController.createCustomer);
router.get('/customers/:customerId/packages', QuotaController.getCustomerPackages);
router.post('/customer-packages', QuotaController.assignPackage);

router.get('/packages', QuotaController.getPackages);
router.post('/packages', QuotaController.createPackage);

router.get('/endpoints', QuotaController.getEndpoints);
router.post('/endpoints', QuotaController.createEndpoint);

router.get('/calls', QuotaController.getCallRecords);
router.get('/calls/:id', QuotaController.getCallRecord);

router.get('/reviews', QuotaController.getReviewRecords);

module.exports = router;
