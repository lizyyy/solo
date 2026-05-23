const express = require('express');
const router = express.Router();
const DeductionRecord = require('../models/DeductionRecord');

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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
