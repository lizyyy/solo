const express = require('express');
const router = express.Router();
const queryService = require('../services/queryService');

router.get('/track-records', (req, res) => {
  try {
    const records = queryService.queryTrackRecords(req.query);
    res.json({ 
      success: true, 
      total: records.length,
      data: records 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/track-records/:id', (req, res) => {
  try {
    const record = queryService.getTrackRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '追踪记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/export', (req, res) => {
  try {
    const filters = req.body.filters || {};
    const records = queryService.queryTrackRecords(filters);
    const csv = queryService.exportToCsv(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="track-records-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const stats = queryService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/route-trace', (req, res) => {
  try {
    const { route_keyword } = req.query;
    if (!route_keyword) {
      return res.status(400).json({ error: '路线关键词不能为空' });
    }
    const records = queryService.queryTrackRecords({ route_keyword });
    const traceData = records.map(r => ({
      record_no: r.record_no,
      order_no: r.order_no,
      address: r.address,
      district: r.district,
      distance_km: r.distance_km,
      route_source: r.route_source,
      handled_at: r.handled_at,
      handled_by: r.handled_by,
      status: r.status,
      reason: r.reason
    }));
    res.json({ 
      success: true, 
      total: traceData.length,
      data: traceData 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
