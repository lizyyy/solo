const express = require('express');
const router = express.Router();
const multer = require('multer');
const licenseService = require('../services/licenseService');
const exportService = require('../services/exportService');
const importService = require('../services/importService');

const upload = multer({ dest: 'uploads/' });

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const result = await licenseService.getLicenses(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const license = await licenseService.getLicenseById(req.params.id);
    res.json(license);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] || req.body.requestId;
    const result = await licenseService.createLicense(req.body, requestId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    const result = await licenseService.updateLicense(req.params.id, req.body, requestId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    const result = await licenseService.submitAnnualCheck(req.params.id, req.body, requestId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const result = await licenseService.reviewLicense(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const buffer = await exportService.exportLicenses(req.body.filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=licenses.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const result = await importService.importLicenses(req.file.path, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const result = await licenseService.addAttachment(req.params.id, req.file, req.body.uploader);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const timeline = await licenseService.getLicenseTimeline(req.params.id);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
