const express = require('express');
const router = express.Router();

const donationController = require('../controllers/donationController');
const invoiceController = require('../controllers/invoiceController');
const reportController = require('../controllers/reportController');
const { idempotencyMiddleware } = require('../middleware/idempotency');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Charity Donation Invoice API is running',
    timestamp: new Date().toISOString()
  });
});

router.post('/projects', donationController.createProject);
router.get('/projects', donationController.getProjects);
router.get('/projects/:projectId', donationController.getProject);
router.get('/projects/:projectId/funds', donationController.getProjectFundUsage);
router.post('/projects/:projectId/funds/usage', donationController.addFundUsage);

router.post('/donations', idempotencyMiddleware, donationController.createDonation);
router.get('/donations', donationController.getDonations);
router.get('/donations/:donationId', donationController.getDonation);
router.post('/donations/:donationId/confirm', idempotencyMiddleware, donationController.confirmDonation);
router.post('/donations/:donationId/refund', idempotencyMiddleware, donationController.refundDonation);

router.post('/invoices', idempotencyMiddleware, invoiceController.applyForInvoice);
router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/:invoiceId', invoiceController.getInvoice);
router.post('/invoices/:invoiceId/issue', idempotencyMiddleware, invoiceController.issueInvoice);
router.post('/invoices/:invoiceId/cancel', idempotencyMiddleware, invoiceController.cancelInvoice);
router.get('/invoices/:invoiceId/download', invoiceController.downloadInvoice);
router.post('/invoices/:invoiceId/correct', idempotencyMiddleware, invoiceController.correctInvoice);

router.post('/merge-requests', idempotencyMiddleware, invoiceController.createMergeRequest);
router.get('/merge-requests', invoiceController.getMergeRequests);
router.get('/merge-requests/:requestId', invoiceController.getMergeRequest);
router.post('/merge-requests/:requestId/process', idempotencyMiddleware, invoiceController.processMergeRequest);

router.get('/reports/financial', reportController.getFinancialReport);
router.get('/reports/projects/:projectId', reportController.getProjectReport);
router.get('/reports/reconciliation', reportController.getFullReconciliationReport);
router.get('/reports/export', reportController.exportReport);
router.get('/reports/summary', reportController.getStatusSummary);

router.get('/history', reportController.getHistory);

module.exports = router;
