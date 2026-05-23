const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const repairOrderService = require('../services/repairOrderService');

router.get('/export', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      isTimeout: req.query.isTimeout === 'true',
      buildingNo: req.query.buildingNo,
      repairType: req.query.repairType,
      isOutsourced: req.query.isOutsourced === 'true'
    };

    const exportData = await repairOrderService.exportReport(filters);

    if (req.query.format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(exportData);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=repair_report_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({ success: true, data: exportData });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const exceptions = await repairOrderService.getExceptions();
    res.json({ success: true, data: exceptions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
