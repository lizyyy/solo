const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { importQaCsv, importSummaryJson, importAppealCsv, autoMatchSummaries } = require('../services/importer');
const { jsonOk, jsonErr } = require('../utils/response');

const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.post('/upload/qa-csv', upload.single('file'), (req, res) => {
  try {
    const buf = fs.readFileSync(req.file.path);
    const result = importQaCsv(buf, req.file.originalname, req.headers['x-actor'] || 'system');
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/upload/summary-json', upload.single('file'), (req, res) => {
  try {
    const buf = fs.readFileSync(req.file.path);
    const result = importSummaryJson(buf, req.file.originalname, req.headers['x-actor'] || 'system');
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/upload/appeal-csv', upload.single('file'), (req, res) => {
  try {
    const buf = fs.readFileSync(req.file.path);
    const result = importAppealCsv(buf, req.file.originalname, req.headers['x-actor'] || 'system');
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/auto-match', (req, res) => {
  try {
    const result = autoMatchSummaries();
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

module.exports = router;
