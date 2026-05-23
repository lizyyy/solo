const express = require('express');
const router = express.Router();
const baseDataService = require('../services/baseDataService');

router.get('/routes', (req, res) => {
  const data = baseDataService.getRoutes();
  res.json({ success: true, data });
});

router.get('/routes/:id', (req, res) => {
  const data = baseDataService.getRouteById(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, error: '线路不存在' });
  }
  res.json({ success: true, data });
});

router.get('/routes/:id/stops', (req, res) => {
  const data = baseDataService.getRouteStops(req.params.id);
  res.json({ success: true, data });
});

router.get('/stops', (req, res) => {
  const includeTemporary = req.query.temporary !== 'false';
  const data = baseDataService.getStops(includeTemporary);
  res.json({ success: true, data });
});

router.get('/stops/:id', (req, res) => {
  const data = baseDataService.getStopById(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, error: '站点不存在' });
  }
  res.json({ success: true, data });
});

router.post('/stops/temporary', (req, res, next) => {
  try {
    const data = baseDataService.addTemporaryStop(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/students', (req, res) => {
  const data = baseDataService.getStudents();
  res.json({ success: true, data });
});

router.get('/students/:id', (req, res) => {
  const data = baseDataService.getStudentById(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }
  res.json({ success: true, data });
});

router.get('/detour-reasons', (req, res) => {
  const data = baseDataService.getDetourReasons();
  res.json({ success: true, data });
});

module.exports = router;
