const express = require('express');
const router = express.Router();
const depositController = require('../controllers/DepositController');
const exportService = require('../services/ExportService');
const path = require('path');

router.get('/health', depositController.healthCheck);

router.post('/customers', depositController.createCustomer);
router.get('/customers', depositController.listCustomers);
router.get('/customers/:id', depositController.getCustomer);

router.post('/delivery-orders', depositController.createDeliveryOrder);
router.get('/delivery-orders/:id', depositController.getDeliveryOrder);

router.post('/return-records', depositController.createReturnRecord);

router.get('/buckets', depositController.listBuckets);

router.get('/status-history/:entityType/:entityId', depositController.getStatusHistory);

router.get('/exceptions', depositController.listExceptions);
router.put('/exceptions/:id', depositController.handleException);

router.post('/manual-corrections', depositController.createManualCorrection);

router.get('/reports/deposit', depositController.getDepositReport);
router.get('/reports/deposit/export', depositController.exportDepositReport);
router.get('/reports/customers/export', depositController.exportCustomerReport);
router.get('/reports/exceptions/export', depositController.exportExceptionLog);

router.get('/exports/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = exportService.getFilePath(fileName);
  res.download(filePath, fileName, (err) => {
    if (err) {
      res.status(404).json({ success: false, message: '文件不存在' });
    }
  });
});

module.exports = router;
