const express = require('express');
const { GiftLockService } = require('../services/giftLockService');

const router = express.Router();
const giftService = new GiftLockService();

router.post('/lock', (req, res) => {
  const result = giftService.lockGift(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/release', (req, res) => {
  const result = giftService.releaseGift(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/manual-correct', (req, res) => {
  const result = giftService.manualCorrect(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

router.get('/status/:lockRecordId', (req, res) => {
  const result = giftService.getLockStatus(req.params.lockRecordId);
  res.status(result.found ? 200 : 404).json(result);
});

router.post('/verify-qualification', (req, res) => {
  const result = giftService.verifyQualification(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

router.get('/locks', (req, res) => {
  const records = giftService.getAllLockRecords();
  res.json({ count: records.length, records });
});

router.get('/release-logs', (req, res) => {
  const logs = giftService.getAllReleaseLogs();
  res.json({ count: logs.length, logs });
});

router.get('/manual-corrections', (req, res) => {
  const corrections = giftService.getAllManualCorrections();
  res.json({ count: corrections.length, corrections });
});

module.exports = router;
