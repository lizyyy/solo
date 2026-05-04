const express = require('express');
const router = express.Router();
const exportUtils = require('../utils/export');

router.get('/building/:building_code', async (req, res) => {
  try {
    const { building_code } = req.params;
    const { format } = req.query;

    const result = await exportUtils.exportBuildingSummary(building_code, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'CSV导出成功',
        filename: result.filename,
        files: {
          summary: result.data.summary,
          construction_batches: result.data.construction_batches,
          complaints: result.data.complaints,
          household_details: result.data.household_details
        }
      });
    } else {
      res.json({
        message: 'JSON导出成功',
        filename: result.filename,
        data: result.data
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all-buildings', async (req, res) => {
  try {
    const { format } = req.query;

    const result = await exportUtils.exportAllBuildings(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'CSV导出成功',
        filename: result.filename,
        csv_data: result.data
      });
    } else {
      res.json({
        message: 'JSON导出成功',
        filename: result.filename,
        data: result.data
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/signatures/:building_code', async (req, res) => {
  try {
    const { building_code } = req.params;
    const { format } = req.query;

    const result = await exportUtils.exportSignatures(building_code, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'CSV导出成功',
        filename: result.filename,
        csv_data: result.data
      });
    } else {
      res.json({
        message: 'JSON导出成功',
        filename: result.filename,
        data: result.data
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/validation-report/:building_code', async (req, res) => {
  try {
    const { building_code } = req.params;
    const { format } = req.query;

    const result = await exportUtils.exportValidationReport(building_code, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'CSV导出成功',
        filename: result.filename,
        files: {
          summary: result.data.summary,
          issues: result.data.issues
        }
      });
    } else {
      res.json({
        message: 'JSON导出成功',
        filename: result.filename,
        data: result.data
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
