const express = require('express');
const router = express.Router();
const acceptanceController = require('../controllers/acceptance.controller');

router.get('/', acceptanceController.getAllAcceptances);
router.post('/admission', acceptanceController.createAdmissionAcceptance);
router.post('/withdrawal', acceptanceController.createWithdrawalAcceptance);
router.post('/refund', acceptanceController.refundDepositAfterAcceptance);
router.get('/:id', acceptanceController.getAcceptanceById);

module.exports = router;