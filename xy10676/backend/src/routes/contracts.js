const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { validatePaymentNodeChange, checkRenewalClause, preventDuplicateSubmission } = require('../middleware/businessRules');

router.get('/', contractController.getAllContracts);
router.get('/dashboard/stats', contractController.getDashboardStats);
router.get('/:id', contractController.getContractById);
router.get('/:id/history', contractController.getContractHistory);
router.post('/', preventDuplicateSubmission, contractController.createContract);
router.put('/:id', validatePaymentNodeChange, checkRenewalClause, contractController.updateContract);

module.exports = router;
