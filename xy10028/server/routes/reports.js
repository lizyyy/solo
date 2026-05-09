const express = require('express');
const { authMiddleware } = require('./auth');
const exportService = require('../services/exportService');

const router = express.Router();

router.use(authMiddleware);

router.get('/inventory/excel', async (req, res, next) => {
  try {
    const { storeId, lowStock } = req.query;

    const buffer = await exportService.exportInventoryToExcel({
      storeId,
      lowStock: lowStock === 'true'
    });

    const filename = `库存报表_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/inventory/markdown', async (req, res, next) => {
  try {
    const { storeId, lowStock } = req.query;

    const markdown = await exportService.exportInventoryToMarkdown({
      storeId,
      lowStock: lowStock === 'true'
    });

    const filename = `库存报表_${new Date().toISOString().slice(0, 10)}.md`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(markdown);
  } catch (error) {
    next(error);
  }
});

router.get('/inventory/pdf', async (req, res, next) => {
  try {
    const { storeId, lowStock } = req.query;

    const buffer = await exportService.exportInventoryToPDF({
      storeId,
      lowStock: lowStock === 'true'
    });

    const filename = `库存报表_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/operations/excel', async (req, res, next) => {
  try {
    const { startDate, endDate, operationType } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: '请提供开始和结束日期' });
    }

    const buffer = await exportService.exportOperationsToExcel({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      operationType
    });

    const filename = `操作日志_${startDate}_${endDate}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
