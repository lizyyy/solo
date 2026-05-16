const express = require('express');
const router = express.Router();
const IdempotentController = require('../controllers/IdempotentController');

router.post('/requests', IdempotentController.createRequest);
router.get('/requests', IdempotentController.listRequests);
router.get('/requests/:request_no', IdempotentController.getRequest);
router.put('/requests/:request_no/status', IdempotentController.updateStatus);
router.post('/requests/:request_no/exception', IdempotentController.handleException);
router.post('/requests/:request_no/manual-correction', IdempotentController.manualCorrection);

router.get('/mediation-records', IdempotentController.listMediationRecords);
router.get('/export', IdempotentController.exportData);

module.exports = router;
