const express = require('express');
const { getBillingSummary, updatePaymentStatus } = require('../services/billingService');
const { 
  exportBillingRecordsToCsv, 
  exportBillingRecordsToExcel, 
  exportOperatorSummary 
} = require('../services/exportService');

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const summary = await getBillingSummary(req.query);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/payment', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const { status } = req.body;
    
    const result = await updatePaymentStatus(req.params.id, status, operator);
    
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

router.get('/export/csv', async (req, res) => {
  try {
    const result = await exportBillingRecordsToCsv(req.query);
    
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/excel', async (req, res) => {
  try {
    const result = await exportBillingRecordsToExcel(req.query);
    
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/operator-summary', async (req, res) => {
  try {
    const result = await exportOperatorSummary(req.query);
    
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
