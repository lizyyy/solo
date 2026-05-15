const express = require('express');
const router = express.Router();
const leaseController = require('../controllers/leaseController');

router.post('/', leaseController.createLease);
router.get('/', leaseController.getLeases);
router.get('/export', leaseController.exportLeases);
router.get('/audit-logs', leaseController.getAuditLogs);
router.post('/check-expired', leaseController.checkExpiredLeases);
router.post('/validate', leaseController.validateLease);
router.get('/:id', leaseController.getLeaseById);
router.get('/:id/history', leaseController.getLeaseHistory);
router.post('/:id/approve', leaseController.approveLease);
router.post('/:id/reject', leaseController.rejectLease);
router.post('/:id/renew', leaseController.renewLease);
router.post('/:id/revoke', leaseController.revokeLease);

module.exports = router;
