const express = require('express');
const router = express.Router();
const ImportService = require('../services/importService');
const dataStore = require('../services/dataStore');

router.post('/audio', (req, res) => {
  try {
    const { records, importedBy } = req.body;
    const result = ImportService.importAudioRecords(records, importedBy || 'system');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/license', (req, res) => {
  try {
    const { recordId, remarks, operator } = req.body;
    const result = ImportService.importLicenseData(recordId, { remarks }, operator || 'system');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/license/batch', (req, res) => {
  try {
    const { licenseData, operator } = req.body;
    const result = ImportService.batchImportLicenseData(licenseData, operator || 'system');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/records', (req, res) => {
  try {
    const { status, assignedTo } = req.query;
    let records = dataStore.readRecords();
    
    if (status) {
      records = records.filter(r => r.status === status);
    }
    if (assignedTo) {
      records = records.filter(r => r.assignedTo === assignedTo);
    }
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/records/:id', (req, res) => {
  try {
    const record = dataStore.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
