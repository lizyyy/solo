const express = require('express');
const router = express.Router();
const TransferExtensionService = require('../services/TransferExtensionService');
const ReportExceptionService = require('../services/ReportExceptionService');

router.post('/', async (req, res) => {
  try {
    const request = await TransferExtensionService.createExtensionRequest(
      req.body.package_id,
      req.body.new_expire_date,
      req.body.reason,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'pending_review',
      data: request
    });
  } catch (error) {
    await ReportExceptionService.logException('create_extension', req.body, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const requests = await TransferExtensionService.getAllExtensionRequests(req.query);
    res.json({
      success: true,
      status: 'completed',
      data: requests
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const request = await TransferExtensionService.getExtensionRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '延期申请不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: request
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const request = await TransferExtensionService.approveExtensionRequest(
      req.params.id,
      req.body.approval_note,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'approved',
      data: request
    });
  } catch (error) {
    await ReportExceptionService.logException('approve_extension', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const request = await TransferExtensionService.rejectExtensionRequest(
      req.params.id,
      req.body.approval_note,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'rejected',
      data: request
    });
  } catch (error) {
    await ReportExceptionService.logException('reject_extension', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.post('/:id/compensate', async (req, res) => {
  try {
    const request = await TransferExtensionService.compensateExtensionRequest(
      req.params.id,
      req.body.approval_note,
      req.body.operator
    );
    res.json({
      success: true,
      status: 'compensated',
      data: request
    });
  } catch (error) {
    await ReportExceptionService.logException('compensate_extension', { ...req.params, ...req.body }, error.message, 'failed', req.body.operator);
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

module.exports = router;
