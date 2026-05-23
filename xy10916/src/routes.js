const express = require('express');
const router = express.Router();
const employeeController = require('./controllers/employeeController');
const certificateController = require('./controllers/certificateController');
const renewalController = require('./controllers/renewalController');

router.get('/', (req, res) => {
  res.json({
    name: '培训证书续期 API',
    version: '1.0.0',
    endpoints: {
      employees: '/api/employees',
      certificates: '/api/certificates',
      renewal: '/api/renewal',
      export: '/api/export'
    }
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/employees', employeeController.createEmployee.bind(employeeController));
router.get('/employees', employeeController.getEmployees.bind(employeeController));
router.get('/employees/:id', employeeController.getEmployeeById.bind(employeeController));
router.put('/employees/:id', employeeController.updateEmployee.bind(employeeController));

router.post('/certificates/types', certificateController.createCertificateType.bind(certificateController));
router.get('/certificates/types', certificateController.getCertificateTypes.bind(certificateController));
router.post('/certificates/employee', certificateController.createEmployeeCertificate.bind(certificateController));
router.get('/certificates/expiring', certificateController.getExpiringCertificates.bind(certificateController));

router.post('/courses', certificateController.createCourse.bind(certificateController));
router.get('/courses', certificateController.getCourses.bind(certificateController));
router.post('/courses/scores', certificateController.createCourseScore.bind(certificateController));
router.post('/courses/retakes', certificateController.createRetakeRecord.bind(certificateController));
router.post('/courses/retakes/process', certificateController.processRetakeResult.bind(certificateController));

router.post('/renewal/position-requirements', renewalController.createPositionRequirement.bind(renewalController));
router.get('/renewal/position-requirements', renewalController.getPositionRequirements.bind(renewalController));

router.post('/renewal/checklist', renewalController.generateRenewalChecklist.bind(renewalController));
router.get('/renewal/checklist', renewalController.getRenewalChecklists.bind(renewalController));
router.put('/renewal/checklist/:id/status', renewalController.updateChecklistStatus.bind(renewalController));

router.get('/renewal/exceptions', renewalController.getProcessingExceptions.bind(renewalController));

router.post('/renewal/manual-correction', renewalController.createManualCorrection.bind(renewalController));
router.get('/renewal/manual-correction', renewalController.getManualCorrections.bind(renewalController));

router.post('/export/checklist/csv', renewalController.exportChecklistCSV.bind(renewalController));
router.post('/export/checklist/json', renewalController.exportChecklistJSON.bind(renewalController));
router.get('/export/files', renewalController.getExportedFiles.bind(renewalController));

router.post('/test/bad-data', renewalController.triggerBadData.bind(renewalController));

module.exports = router;
