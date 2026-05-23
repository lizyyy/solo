const express = require('express');
const router = express.Router();
const SupplementaryService = require('../services/SupplementaryService');
const SupplementaryDeduction = require('../models/SupplementaryDeduction');
const ExceptionLog = require('../models/ExceptionLog');

router.post('/', async (req, res) => {
  try {
    const { plate_number, original_event_id, amount, reason, applicant } = req.body;

    if (!plate_number || !amount || !reason) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const result = await SupplementaryService.createApplication({
      plate_number,
      original_event_id: original_event_id || null,
      amount,
      reason,
      applicant: applicant || null
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'create_supplementary_error',
      raw_input: req.body,
      error_message: error.message,
      api_path: req.path
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:supplementaryNo/review', async (req, res) => {
  try {
    const { supplementaryNo } = req.params;
    const { action, reviewer, review_remark } = req.body;

    if (!action || !reviewer) {
      return res.status(400).json({
        success: false,
        error: '缺少审核操作或审核人'
      });
    }

    const result = await SupplementaryService.reviewApplication(
      supplementaryNo,
      action,
      reviewer,
      review_remark || null
    );

    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'review_supplementary_error',
      raw_input: req.body,
      error_message: error.message,
      api_path: req.path
    });

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const applications = await SupplementaryDeduction.listByStatus(
      status,
      parseInt(page),
      parseInt(pageSize)
    );

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/plate/:plateNumber', async (req, res) => {
  try {
    const { plateNumber } = req.params;
    const applications = await SupplementaryDeduction.listByPlate(plateNumber);

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/flow', (req, res) => {
  res.json({
    success: true,
    data: SupplementaryService.getStatusFlow()
  });
});

module.exports = router;
