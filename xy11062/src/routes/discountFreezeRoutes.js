const express = require('express');
const router = express.Router();
const discountFreezeController = require('../controllers/discountFreezeController');

router.post('/', discountFreezeController.createFreeze);
router.get('/', discountFreezeController.getFreezeList);
router.get('/exceptions', discountFreezeController.getExceptionList);
router.get('/stats', discountFreezeController.getStats);
router.put('/:freezeId/audit', discountFreezeController.auditFreeze);
router.put('/exceptions/:exceptionId/handle', discountFreezeController.handleException);

module.exports = router;
