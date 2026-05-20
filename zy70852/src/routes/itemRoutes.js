const express = require('express');
const multer = require('multer');
const itemController = require('../controllers/itemController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/batches', itemController.createBatch);
router.get('/batches', itemController.listBatches);

router.post('/upload/lost-items', upload.single('file'), itemController.uploadLostItemsCSV);
router.post('/upload/route-schedules', upload.single('file'), itemController.uploadRouteSchedulesJSON);
router.post('/upload/images', itemController.importImageIndex);

router.get('/items', itemController.listItems);
router.get('/items/:itemId', itemController.getItemDetail);
router.post('/items/:itemId/process', itemController.processItem);
router.post('/items/:itemId/return', itemController.returnForModification);
router.post('/items/:itemId/process/mark', itemController.markProcessed);
router.post('/items/:itemId/complete', itemController.markCompleted);
router.post('/items/:itemId/issue-voucher', itemController.issuePickupVoucher);

router.get('/vouchers/:voucherNo', itemController.getVoucherDetail);
router.get('/vouchers/:voucherNo/trace', itemController.traceVoucher);
router.post('/vouchers/:voucherNo/pickup', itemController.pickupItem);

router.get('/query/by-route', itemController.getItemsByRoute);
router.get('/query/by-driver', itemController.getItemsByDriver);

router.get('/export', itemController.exportItems);

router.post('/tasks/check-overdue', itemController.checkOverdue);
router.post('/tasks/check-same-name', itemController.checkSameName);

module.exports = router;
