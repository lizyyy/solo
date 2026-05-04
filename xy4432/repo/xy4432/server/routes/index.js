const express = require('express');
const router = express.Router();
const routesController = require('../controllers/routesController');
const riskController = require('../controllers/riskController');
const exportController = require('../controllers/exportController');
const dataController = require('../controllers/dataController');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

router.post('/routes', routesController.createRoute);
router.get('/routes', routesController.getRoutes);
router.get('/routes/:id', routesController.getRouteById);
router.put('/routes/:id', routesController.updateRoute);
router.delete('/routes/:id', routesController.deleteRoute);

router.get('/walls', dataController.getWalls);
router.post('/walls', dataController.createWall);

router.post('/import/holds', dataController.importHolds);
router.post('/import/heatmap', dataController.importHeatmap);
router.post('/import/feedback', dataController.importFeedback);

router.post('/risk/analyze', riskController.analyzeRisks);
router.get('/risk/types', riskController.getRiskTypes);

router.post('/export/markdown', exportController.exportMarkdown);
router.post('/export/json', exportController.exportJson);

module.exports = router;
