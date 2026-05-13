const express = require('express');
const router = express.Router();
const InspectionController = require('./controllers/inspectionController');
const ExportController = require('./controllers/exportController');
const ImportController = require('./controllers/importController');

router.post('/inspections', InspectionController.create);
router.put('/inspections/:id/advance', InspectionController.advance);
router.put('/inspections/:id/correct', InspectionController.correct);
router.get('/inspections', InspectionController.getAll);
router.get('/inspections/:id', InspectionController.getById);
router.get('/inspections/:id/timeline', InspectionController.getTimeline);
router.get('/inspections/:id/history', InspectionController.getFieldHistory);

router.get('/export/excel', ExportController.exportToExcel);
router.get('/export/trend', ExportController.getMaintenanceTrend);

router.get('/import/template', ImportController.getTemplate);
router.post('/import/csv', ImportController.getUploadMiddleware(), ImportController.importCSV);

module.exports = router;
