const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/ApprovalController');

router.post('/', ApprovalController.createApprovalRequest);
router.get('/pending', ApprovalController.getPendingRequests);
router.get('/:id', ApprovalController.getRequestById);
router.post('/:id/approve', ApprovalController.approveRequest);
router.post('/:id/reject', ApprovalController.rejectRequest);
router.get('/contract/:contractId', ApprovalController.getRequestsByContract);

module.exports = router;
