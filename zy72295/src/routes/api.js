const express = require('express');
const router = express.Router();
const { cadLayerService } = require('../services/CADLayerService');
const { temperatureZoneService } = require('../services/TemperatureZoneService');
const { measurementService } = require('../services/MeasurementService');
const { exportService } = require('../services/ExportService');
const { store } = require('../store/FileStore');
const { getUserFriendlyError } = require('../utils/errors');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/stats', (req, res) => {
  res.json({
    layers: cadLayerService.getAllLayers().length,
    zones: temperatureZoneService.getAllZones().length,
    routes: measurementService.getAllRoutes().length,
    records: measurementService.getAllRecords().length,
    exports: exportService.getExportHistory(100).length,
    globalSeq: store.getGlobalSeq()
  });
});

router.get('/zones', (req, res) => {
  const zones = temperatureZoneService.getAllZones();
  const summaries = zones.map(z => temperatureZoneService.getZoneSummary(z.id));
  res.json({ success: true, data: summaries });
});

router.get('/zones/:id', (req, res) => {
  const detail = temperatureZoneService.getZoneDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, message: '温区不存在' });
  }
  res.json({ success: true, data: detail });
});

router.get('/zones/:id/history', (req, res) => {
  const history = temperatureZoneService.getZoneHistory(req.params.id);
  res.json({ success: true, data: history });
});

router.post('/zones', express.json(), (req, res) => {
  const result = temperatureZoneService.createZone(req.body, req.body.operator || 'web');
  res.json(result);
});

router.put('/zones/:id', express.json(), (req, res) => {
  const result = temperatureZoneService.updateZone(req.params.id, req.body, req.body.operator || 'web');
  res.json(result);
});

router.get('/layers', (req, res) => {
  const layers = cadLayerService.getAllLayers();
  res.json({ success: true, data: layers });
});

router.get('/layers/:id', (req, res) => {
  const detail = cadLayerService.getLayerDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, message: '图层不存在' });
  }
  res.json({ success: true, data: detail });
});

router.post('/layers/import', express.json(), (req, res) => {
  const layers = req.body.layers || [];
  const operator = req.body.operator || 'web';
  const result = cadLayerService.importLayers(layers, operator);
  res.json({ success: true, data: result });
});

router.get('/routes', (req, res) => {
  const routes = measurementService.getAllRoutes();
  const summaries = routes.map(r => measurementService.getRouteSummary(r.id));
  res.json({ success: true, data: summaries });
});

router.get('/routes/:id', (req, res) => {
  const detail = measurementService.getRouteDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, message: '路线不存在' });
  }
  res.json({ success: true, data: detail });
});

router.post('/routes', express.json(), (req, res) => {
  const route = measurementService.addSupplementaryRoute(req.body, req.body.operator || 'web');
  res.json({ success: true, data: route });
});

router.post('/routes/:id/recalculate', express.json(), (req, res) => {
  const result = measurementService.recalculateRouteLength(req.params.id, req.body.operator || 'web');
  if (!result) {
    return res.status(404).json({ success: false, message: '路线不存在' });
  }
  res.json({ success: true, data: result });
});

router.post('/routes/:id/mark-review', express.json(), (req, res) => {
  const result = measurementService.markRouteForCustomerReview(req.params.id, req.body.operator || 'web', req.body.reason);
  if (!result) {
    return res.status(404).json({ success: false, message: '路线不存在' });
  }
  res.json({ success: true, data: result });
});

router.post('/routes/:id/complete-review', express.json(), (req, res) => {
  const { approved, remark, operator } = req.body;
  const result = measurementService.completeCustomerReview(req.params.id, operator || 'web', approved, remark);
  if (!result) {
    return res.status(404).json({ success: false, message: '路线不存在' });
  }
  res.json({ success: true, data: result });
});

router.post('/routes/:id/link-measurement', express.json(), (req, res) => {
  const { measurementId, operator } = req.body;
  const result = measurementService.linkRouteToMeasurement(req.params.id, measurementId, operator || 'web');
  res.json(result);
});

router.get('/records', (req, res) => {
  const records = measurementService.getAllRecords();
  res.json({ success: true, data: records });
});

router.post('/records', express.json(), (req, res) => {
  const record = measurementService.addMeasurementRecord(req.body, req.body.operator || 'web');
  res.json({ success: true, data: record });
});

router.get('/view-3d/click/:zoneId', (req, res) => {
  const { VisualizationService } = require('../services/VisualizationService');
  const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
  const result = viz.clickZoneInView('web', req.params.zoneId);
  res.json(result);
});

router.get('/view-3d/navigate-layer/:zoneId', (req, res) => {
  const { VisualizationService } = require('../services/VisualizationService');
  const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
  const result = viz.navigateToCADLayer('web', req.params.zoneId);
  res.json(result);
});

router.get('/view-3d/navigate-measurement/:zoneId', (req, res) => {
  const { VisualizationService } = require('../services/VisualizationService');
  const viz = new VisualizationService(cadLayerService, measurementService, temperatureZoneService);
  const result = viz.navigateToMeasurement('web', req.params.zoneId);
  res.json(result);
});

router.get('/exports/can-export', (req, res) => {
  const result = exportService.canExportScreenshot();
  res.json(result);
});

router.get('/exports', (req, res) => {
  const history = exportService.getExportHistory(50);
  res.json({ success: true, data: history });
});

router.get('/exports/:id', (req, res) => {
  const record = exportService.getExportById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: '导出记录不存在' });
  }
  res.json({ success: true, data: record });
});

router.post('/exports', express.json(), async (req, res) => {
  try {
    const result = await exportService.exportScreenshot(
      req.body.viewId || 'web',
      req.body.exporter || 'web',
      { zoneIds: req.body.zoneIds }
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/clear-all', (req, res) => {
  store.clearAll();
  const { historyManager } = require('../utils/history');
  historyManager.reloadFromStore();
  res.json({ success: true, message: '所有数据已清空' });
});

router.post('/reload', (req, res) => {
  store.reload();
  const { historyManager } = require('../utils/history');
  historyManager.reloadFromStore();
  res.json({ success: true, message: '已从文件重新加载数据' });
});

router.get('/boundary-rules', (req, res) => {
  res.json({ success: true, data: temperatureZoneService.getBoundaryRules() });
});

module.exports = router;
