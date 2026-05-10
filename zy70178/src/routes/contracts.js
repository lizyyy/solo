const express = require('express');
const router = express.Router();
const ContractController = require('../controllers/ContractController');

router.post('/', ContractController.createContract);
router.get('/no/:contractNo', ContractController.getContractByNo);
router.get('/:id', ContractController.getContractById);
router.get('/:contractId/versions', ContractController.getAllVersions);
router.get('/versions/:versionId', ContractController.getVersionById);
router.post('/:contractId/amount', ContractController.updateAmount);
router.post('/:contractId/tax-rate', ContractController.updateTaxRate);
router.get('/:contractId/report', ContractController.getBusinessReport);
router.post('/:contractId/recalculate/tax-rule', ContractController.recalculateWithNewTaxRule);
router.post('/:contractId/recalculate/amount', ContractController.recalculateWithNewAmount);
router.post('/:contractId/recalculate/preview', ContractController.previewRecalculation);
router.get('/:contractId/verify', ContractController.verifyAllVersions);

module.exports = router;
