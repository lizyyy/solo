const express = require('express');
const router = express.Router();
const drillController = require('./controllers/drillController');
const analysisController = require('./controllers/analysisController');
const reportController = require('./controllers/reportController');
const { upload } = require('./middleware/upload');

router.post('/drills', upload.any(), drillController.createDrill);
router.get('/drills', drillController.listDrills);
router.get('/drills/:id', drillController.getDrill);
router.put('/drills/:id', drillController.updateDrill);
router.delete('/drills/:id', drillController.deleteDrill);

router.post('/drills/:id/analyze', analysisController.runAnalysis);
router.get('/drills/:id/analysis', analysisController.getAnalysis);

router.get('/drills/:id/report/markdown', reportController.exportMarkdown);
router.get('/drills/:id/report/json', reportController.exportJson);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
