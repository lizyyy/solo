const express = require('express');
const router = express.Router();

const customersRouter = require('./customers');
const claysRouter = require('./clays');
const glazesRouter = require('./glazes');
const artworksRouter = require('./artworks');
const kilnsRouter = require('./kilns');
const shelvesRouter = require('./shelves');
const firingCurvesRouter = require('./firingCurves');
const firingTasksRouter = require('./firingTasks');
const importExportRouter = require('./importExport');

router.use('/customers', customersRouter);
router.use('/clays', claysRouter);
router.use('/glazes', glazesRouter);
router.use('/artworks', artworksRouter);
router.use('/kilns', kilnsRouter);
router.use('/shelves', shelvesRouter);
router.use('/firing-curves', firingCurvesRouter);
router.use('/firing-tasks', firingTasksRouter);
router.use('/import-export', importExportRouter);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/', (req, res) => {
  res.json({
    message: '窑炉排烧系统 API',
    version: '1.0.0',
    endpoints: {
      customers: '/api/customers',
      clays: '/api/clays',
      glazes: '/api/glazes',
      artworks: '/api/artworks',
      kilns: '/api/kilns',
      shelves: '/api/shelves',
      'firing-curves': '/api/firing-curves',
      'firing-tasks': '/api/firing-tasks',
      'import-export': '/api/import-export'
    }
  });
});

module.exports = router;
