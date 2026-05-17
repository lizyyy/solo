const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const itemController = require('../controllers/itemController');
const advancedController = require('../controllers/advancedController');
const { validate, schemas } = require('../middleware/validate');

router.get('/', (req, res) => {
  res.json({ success: true, message: '安全例行巡检API', version: '1.0.0' });
});

router.post('/batches', validate(schemas.batch), batchController.createBatch);
router.get('/batches', batchController.getBatches);
router.get('/batches/:id', batchController.getBatchDetail);
router.put('/batches/:id/status', batchController.updateBatchStatus);

router.post('/items', validate(schemas.inspectionItem), itemController.createItem);
router.get('/items', itemController.getItems);
router.get('/items/:id', itemController.getItemDetail);
router.put('/items/:id/status', validate(schemas.statusUpdate), itemController.updateItemStatus);

router.post('/rectification', validate(schemas.rectification), itemController.submitRectification);

router.post('/review', validate(schemas.review), itemController.submitReview);

router.post('/corrections', validate(schemas.manualCorrection), advancedController.manualCorrection);

router.get('/exceptions', advancedController.getExceptions);
router.put('/exceptions/:id', validate(schemas.exceptionHandle), advancedController.handleException);

router.get('/overdue', advancedController.getOverdueReminders);

router.get('/export', advancedController.exportToCsv);

router.get('/statistics', advancedController.getStatistics);

router.post('/reports', advancedController.generateReport);

router.get('/reports', (req, res, next) => {
  const db = require('../config/database');
  db.all(`SELECT * FROM inspection_reports ORDER BY created_at DESC`, (err, reports) => {
    if (err) return next(err);
    res.json({ success: true, data: reports });
  });
});

router.get('/risk-levels', (req, res, next) => {
  const db = require('../config/database');
  db.all(`SELECT * FROM risk_levels ORDER BY severity DESC`, (err, levels) => {
    if (err) return next(err);
    res.json({ success: true, data: levels });
  });
});

module.exports = router;
