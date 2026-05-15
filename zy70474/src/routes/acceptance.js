const express = require('express');
const router = express.Router();
const acceptanceService = require('../services/acceptance');

router.post('/submit', async (req, res) => {
  try {
    const { formData, items } = req.body;

    if (!formData || !items || !Array.isArray(items)) {
      return res.status(400).json({
        error: '参数错误',
        message: 'formData和items为必填项'
      });
    }

    const result = await acceptanceService.submitAcceptanceForm(formData, items);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    const result = await acceptanceService.getAcceptanceDetail(formId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '验收单不存在'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;