const express = require('express');
const router = express.Router();

const importController = require('../controllers/importController');
const analysisController = require('../controllers/analysisController');
const taskController = require('../controllers/taskController');
const reportController = require('../controllers/reportController');
const dataController = require('../controllers/dataController');

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Message Queue Analyzer API',
    version: '1.0.0',
    endpoints: {
      import: '/api/import',
      analysis: '/api/analysis',
      tasks: '/api/tasks',
      reports: '/api/reports',
      data: '/api/data'
    }
  });
});

const importRouter = express.Router();
importRouter.post('/producers', importController.importProducers);
importRouter.post('/topics', importController.importTopics);
importRouter.post('/messages', importController.importMessages);
importRouter.post('/delivery-events', importController.importDeliveryEvents);
importRouter.post('/all', importController.importAll);
router.use('/import', importRouter);

const analysisRouter = express.Router();
analysisRouter.get('/messages/:messageId', analysisController.analyzeMessage);
analysisRouter.get('/messages/:messageId/delivery-chain', analysisController.getMessageDeliveryChain);
analysisRouter.post('/messages/:messageId/replay', analysisController.replayMessage);
analysisRouter.post('/batch', analysisController.batchAnalyze);
analysisRouter.get('/statistics', analysisController.getStatistics);
analysisRouter.get('/results', analysisController.getAllAnalysisResults);
analysisRouter.get('/results/:id', analysisController.getAnalysisResult);
router.use('/analysis', analysisRouter);

const tasksRouter = express.Router();
tasksRouter.post('/', taskController.createTask);
tasksRouter.get('/', taskController.getAllTasks);
tasksRouter.get('/:id', taskController.getTask);
tasksRouter.put('/:id', taskController.updateTask);
tasksRouter.post('/:id/execute', taskController.executeTask);
tasksRouter.post('/:id/report', taskController.generateTaskReport);
router.use('/tasks', tasksRouter);

const reportsRouter = express.Router();
reportsRouter.post('/json', reportController.generateJSONReport);
reportsRouter.post('/markdown', reportController.generateMarkdownReport);
reportsRouter.get('/', reportController.getAllReports);
reportsRouter.get('/:id', reportController.getReport);
reportsRouter.get('/:id/export', reportController.exportReport);
router.use('/reports', reportsRouter);

const dataRouter = express.Router();
dataRouter.get('/producers', dataController.getProducers);
dataRouter.get('/producers/:id', dataController.getProducer);
dataRouter.get('/topics', dataController.getTopics);
dataRouter.get('/topics/:id', dataController.getTopic);
dataRouter.get('/messages', dataController.getMessages);
dataRouter.get('/messages/:id', dataController.getMessage);
dataRouter.get('/delivery-events', dataController.getDeliveryEvents);
dataRouter.get('/delivery-events/:id', dataController.getDeliveryEvent);
dataRouter.get('/stats', dataController.getStats);
dataRouter.delete('/clear', dataController.clearAllData);
router.use('/data', dataRouter);

module.exports = router;
