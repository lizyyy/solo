const express = require('express');
const router = express.Router();
const callbackController = require('../controllers/callbackController');

router.get('/exhausted', callbackController.getExhaustedCallbacks);

router.post('/retry', callbackController.retryFailedCallbacks);

router.get('/stats', callbackController.getCallbackStats);

router.get('/contract/:contractId', callbackController.getContractCallbacks);

router.get('/:callbackId', callbackController.getCallbackStatus);

router.post('/:callbackId/retry', callbackController.manualRetryCallback);

router.post('/:callbackId/compensate', callbackController.triggerCompensation);

module.exports = router;
