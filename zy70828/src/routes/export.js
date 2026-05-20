const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');

router.get('/records', async (req, res) => {
  try {
    const filters = {
      ward: req.query.ward,
      department: req.query.department,
      status: req.query.status,
      record_type: req.query.record_type,
      handler: req.query.handler
    };
    const format = req.query.format || 'csv';

    const result = await ExportService.exportTrackingRecords(filters, format);

    const filename = `tracking_records_${Date.now()}.${format}`;
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'json') {
      res.json(result.data);
    } else {
      res.send(result.data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/beds', async (req, res) => {
  try {
    const ward = req.query.ward;
    const result = await ExportService.exportBedStatus(ward);

    const filename = `bed_status_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cleaning-orders', async (req, res) => {
  try {
    const status = req.query.status;
    const result = await ExportService.exportCleaningOrders(status);

    const filename = `cleaning_orders_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient-outcome', async (req, res) => {
  try {
    const department = req.query.department;
    const result = await ExportService.exportPatientOutcome(department);

    const filename = `patient_outcome_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
