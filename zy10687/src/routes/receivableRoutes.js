const express = require('express');
const router = express.Router();
const ReceivableController = require('../controllers/receivableController');

router.post('/', ReceivableController.create);
router.post('/:id/apply-unlock', ReceivableController.applyUnlock);
router.post('/:id/approve-unlock', ReceivableController.approveUnlock);
router.post('/:id/reject-unlock', ReceivableController.rejectUnlock);
router.get('/:id', ReceivableController.getDetail);
router.get('/', ReceivableController.getList);
router.get('/:receivableId/histories', ReceivableController.getHistories);
router.get('/export/csv', ReceivableController.export);
router.post('/import/batch', ReceivableController.import);
router.get('/import/logs', ReceivableController.getImportLogs);
router.get('/import/bad-rows/:batchNo', ReceivableController.getBadRows);

module.exports = router;