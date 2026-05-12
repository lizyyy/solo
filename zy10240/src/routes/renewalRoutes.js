const express = require('express');
const router = express.Router();
const renewalController = require('../controllers/renewalController');

router.post('/contracts', renewalController.createContract);
router.get('/contracts', renewalController.getAllContracts);
router.get('/contracts/:id', renewalController.getContract);
router.get('/contracts/:id/history', renewalController.getContractHistory);
router.post('/contracts/:id/confirm', renewalController.confirmContract);
router.post('/contracts/:id/cancel', renewalController.cancelContract);
router.post('/contracts/:id/generate-bill', renewalController.generateBill);

router.get('/bills', renewalController.getAllBills);
router.get('/bills/:id', renewalController.getBill);
router.get('/bills/:id/history', renewalController.getBillHistory);
router.post('/bills/:id/issue', renewalController.issueBill);
router.post('/bills/:id/mark-paid', renewalController.markBillPaid);

module.exports = router;
