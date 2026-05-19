const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

router.post('/import', callController.importCalls);
router.get('/', callController.getCalls);
router.get('/export', callController.exportCalls);
router.get('/:id', callController.getCallDetail);
router.put('/:id/review', callController.reviewCall);
router.post('/batch-review', callController.batchReview);
router.get('/batch/:id', callController.getBatchOperation);

module.exports = router;
