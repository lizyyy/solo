const express = require('express');
const ApprovalController = require('../controllers/approval.controller');

const router = express.Router();
const controller = new ApprovalController();

router.post('/', (req, res) => controller.createApproval(req, res));
router.get('/:approvalId', (req, res) => controller.getApproval(req, res));
router.get('/application/:applicationId', (req, res) => controller.getApprovalByApplication(req, res));
router.post('/:approvalId/approve', (req, res) => controller.approve(req, res));
router.post('/:approvalId/reject', (req, res) => controller.reject(req, res));
router.post('/:approvalId/cancel', (req, res) => controller.cancel(req, res));

module.exports = router;
