const express = require('express');
const router = express.Router();
const DeductionRecord = require('../models/DeductionRecord');
const ExceptionLog = require('../models/ExceptionLog');

router.get('/plate/:plateNumber', async (req, res) => {
  try {
    const { plateNumber } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const records = await DeductionRecord.listByPlate(
      plateNumber,
      parseInt(page),
      parseInt(pageSize)
    );

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'list_deductions_error',
      raw_input: { plateNumber: req.params.plateNumber, ...req.query },
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:deductionNo', async (req, res) => {
  try {
    const { deductionNo } = req.params;
    const record = await DeductionRecord.findByDeductionNo(deductionNo);

    if (!record) {
      await ExceptionLog.create({
        exception_type: 'deduction_not_found',
        raw_input: { deductionNo },
        error_message: '扣费记录不存在',
        processing_result: '返回404错误',
        api_path: req.path
      });
      return res.status(404).json({
        success: false,
        error: '扣费记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'get_deduction_error',
      raw_input: req.params,
      error_message: error.message,
      processing_result: '返回500错误',
      api_path: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
