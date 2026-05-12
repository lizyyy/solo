import { Router } from 'express';
import * as equipmentController from '../controllers/equipmentController';
import * as templateController from '../controllers/templateController';
import * as inspectionController from '../controllers/inspectionController';
import * as exceptionController from '../controllers/exceptionController';
import * as reportController from '../controllers/reportController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.post('/equipment', equipmentController.createEquipment);
router.get('/equipment', equipmentController.getAllEquipment);
router.get('/equipment/:id', equipmentController.getEquipment);
router.put('/equipment/:id/status', equipmentController.updateEquipmentStatus);

router.post('/templates', templateController.createTemplate);
router.get('/templates/:id', templateController.getTemplate);
router.get('/equipment/:equipmentId/templates', templateController.getTemplatesByEquipment);
router.post('/templates/items', templateController.addCheckItem);
router.get('/templates/:id/items', templateController.getTemplateItems);

router.post('/inspections', inspectionController.createInspection);
router.get('/inspections', inspectionController.getAllInspections);
router.get('/inspections/:id', inspectionController.getInspection);
router.post('/inspections/:id/check', inspectionController.checkItem);
router.get('/inspections/:id/results', inspectionController.getInspectionItemResults);
router.post('/inspections/:id/complete', inspectionController.completeInspection);
router.post('/inspections/:id/close', inspectionController.closeInspection);

router.post('/exceptions', exceptionController.reportException);
router.get('/exceptions', exceptionController.getAllExceptions);
router.get('/exceptions/:id', exceptionController.getException);
router.post('/exceptions/:id/recheck', exceptionController.recheckException);
router.get('/exceptions/:exceptionId/rechecks', exceptionController.getRechecksByException);

router.post('/downtime', exceptionController.createDowntime);
router.get('/downtime', exceptionController.getAllDowntime);
router.post('/downtime/:id/end', exceptionController.endDowntime);

router.post('/maintenance', exceptionController.assignMaintenance);
router.get('/maintenance/:id', exceptionController.getMaintenance);
router.get('/exceptions/:exceptionId/maintenance', exceptionController.getMaintenanceByException);
router.post('/maintenance/:id/start', exceptionController.startMaintenance);
router.post('/maintenance/:id/complete', exceptionController.completeMaintenance);

router.post('/manual-correction', exceptionController.manualCorrection);

router.get('/reports/equipment/:id/status', reportController.getEquipmentStatus);
router.get('/reports/exceptions/:id/timeline', reportController.getExceptionTimeline);
router.get('/reports/inspections/:id', reportController.getShiftInspectionReport);
router.get('/reports/dashboard', reportController.getDashboardStats);
router.get('/reports/history/:entityType/:entityId', reportController.getHistory);
router.get('/reports/export/shift-csv', reportController.exportShiftReportCSV);

export default router;
