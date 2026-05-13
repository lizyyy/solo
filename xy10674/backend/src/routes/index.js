const express = require('express');
const router = express.Router();
const { auth, roleAuth } = require('../middleware/auth');
const storeCollectionController = require('../controllers/storeCollectionController');
const exportController = require('../controllers/exportController');
const logController = require('../controllers/logController');

// 门店回收相关路由
router.post('/store-collections', auth, storeCollectionController.create);
router.put('/store-collections/:id', auth, storeCollectionController.update);
router.post('/store-collections/:id/review', auth, roleAuth('reviewer', 'admin'), storeCollectionController.review);
router.get('/store-collections/:id', auth, storeCollectionController.getDetail);
router.get('/store-collections', auth, storeCollectionController.list);

// 导出相关路由
router.post('/export/deposit-report', auth, exportController.exportDepositReport);
router.post('/export/supplier-handover-report', auth, exportController.exportSupplierHandoverReport);
router.post('/export/deposit-flow-report', auth, exportController.exportDepositFlowReport);

// 日志相关路由
router.get('/logs/operations', auth, roleAuth('admin'), logController.getOperationLogs);
router.get('/logs/modifications', auth, roleAuth('admin'), logController.getModificationHistory);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
