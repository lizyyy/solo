const express = require('express');
const router = express.Router();
const { getCommandFullTrace, getDeviceEventTimeline, getConsistencyReport, searchEvents } = require('../services/eventService');

router.get('/trace/command/:commandId', (req, res) => {
  const trace = getCommandFullTrace(req.params.commandId);
  if (!trace) {
    return res.status(404).json({ success: false, error: '指令不存在' });
  }
  res.json({ success: true, data: trace });
});

router.get('/timeline/device/:deviceId', (req, res) => {
  const { startTime, endTime } = req.query;
  const timeline = getDeviceEventTimeline(req.params.deviceId, startTime, endTime);
  res.json({ success: true, data: timeline });
});

router.get('/consistency/:commandId', (req, res) => {
  const report = getConsistencyReport(req.params.commandId);
  if (report.error) {
    return res.status(404).json({ success: false, error: report.error });
  }
  res.json({ success: true, data: report });
});

router.get('/search', (req, res) => {
  const { keyword, deviceId, startTime, endTime } = req.query;
  const results = searchEvents(keyword, { deviceId, startTime, endTime });
  res.json({ success: true, data: results });
});

module.exports = router;
