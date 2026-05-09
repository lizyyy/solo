const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');

router.get('/state-info', contractController.getStateInfo);

router.post('/', contractController.createContract);

router.get('/', contractController.getContracts);

router.get('/:contractId', contractController.getContract);

router.put('/:contractId', contractController.updateContract);

router.delete('/:contractId', contractController.deleteContract);

router.post('/:contractId/initiate', contractController.initiateSigning);

router.post('/:contractId/sign', contractController.signContract);

router.post('/:contractId/reject', contractController.rejectContract);

router.post('/:contractId/withdraw', contractController.withdrawContract);

router.post('/:contractId/reinitiate', contractController.reinitiateContract);

router.post('/:contractId/supplement-sign', contractController.supplementSign);

router.get('/:contractId/allowed-transitions', contractController.checkAllowedTransitions);

module.exports = router;
