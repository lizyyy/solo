const express = require('express');
const router = express.Router();

const plotController = require('../controllers/plotController');
const gradeController = require('../controllers/gradeController');
const lossReasonController = require('../controllers/lossReasonController');
const managerController = require('../controllers/managerController');
const harvestTaskController = require('../controllers/harvestTaskController');
const batchController = require('../controllers/batchController');
const inspectionController = require('../controllers/inspectionController');
const dashboardController = require('../controllers/dashboardController');

router.get('/', (req, res) => {
  res.json({ message: '农产品采收入库台 API 服务运行中' });
});

router.get('/plots', plotController.getAllPlots);
router.get('/plots/:id', plotController.getPlotById);
router.post('/plots', plotController.createPlot);
router.put('/plots/:id', plotController.updatePlot);
router.delete('/plots/:id', plotController.deletePlot);

router.get('/grades', gradeController.getAllGrades);
router.post('/grades', gradeController.createGrade);
router.put('/grades/:id', gradeController.updateGrade);
router.delete('/grades/:id', gradeController.deleteGrade);

router.get('/loss-reasons', lossReasonController.getAllLossReasons);
router.post('/loss-reasons', lossReasonController.createLossReason);
router.put('/loss-reasons/:id', lossReasonController.updateLossReason);
router.delete('/loss-reasons/:id', lossReasonController.deleteLossReason);

router.get('/managers', managerController.getAllManagers);
router.post('/managers', managerController.createManager);
router.put('/managers/:id', managerController.updateManager);
router.delete('/managers/:id', managerController.deleteManager);

router.get('/harvest-tasks', harvestTaskController.getAllHarvestTasks);
router.get('/harvest-tasks/:id', harvestTaskController.getHarvestTaskById);
router.post('/harvest-tasks', harvestTaskController.createHarvestTask);
router.put('/harvest-tasks/:id', harvestTaskController.updateHarvestTask);
router.delete('/harvest-tasks/:id', harvestTaskController.deleteHarvestTask);

router.get('/batches', batchController.getAllBatches);
router.get('/batches/:id', batchController.getBatchById);
router.post('/batches', batchController.createBatch);
router.put('/batches/:id', batchController.updateBatch);
router.delete('/batches/:id', batchController.deleteBatch);
router.get('/batches/:id/history', batchController.getBatchHistory);
router.post('/batches/:id/adjust-grade', batchController.adjustBatchGrade);

router.get('/inspections', inspectionController.getAllInspections);
router.get('/inspections/batch/:batchId', inspectionController.getInspectionsByBatch);
router.post('/inspections', inspectionController.createInspection);
router.put('/inspections/:id', inspectionController.updateInspection);

router.get('/dashboard', dashboardController.getDashboardStats);
router.get('/stock/available', dashboardController.getAvailableStock);
router.get('/stock/quarantined', dashboardController.getQuarantinedStock);
router.get('/reports/harvest/export', dashboardController.exportHarvestReport);

module.exports = router;
