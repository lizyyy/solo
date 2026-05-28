const express = require('express');
const multer = require('multer');
const path = require('path');
const ApiController = require('../controllers/ApiController');

const router = express.Router();
const apiController = new ApiController();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 20 }
]);

router.get('/dashboard', (req, res) => apiController.getDashboard(req, res));
router.get('/next-steps', (req, res) => apiController.getNextSteps(req, res));
router.get('/consistency', (req, res) => apiController.getConsistencyCheck(req, res));
router.get('/input-types', (req, res) => apiController.getInputTypes(req, res));

router.post('/process-directory', (req, res) => apiController.processDirectory(req, res));
router.post('/upload', uploadFields, (req, res) => apiController.uploadAndProcess(req, res));
router.post('/files/upload', uploadFields, (req, res) => apiController.uploadAndProcess(req, res));

router.get('/grace-analysis', (req, res) => apiController.runGraceAnalysis(req, res));
router.post('/grace-analysis', (req, res) => apiController.runGraceAnalysis(req, res));

router.get('/reminder-list', (req, res) => apiController.generateReminderList(req, res));
router.post('/reminder-list', (req, res) => apiController.generateReminderList(req, res));
router.post('/execute-reminders', (req, res) => apiController.executeReminders(req, res));
router.get('/reminder-templates', (req, res) => apiController.getReminderTemplates(req, res));
router.get('/reminder-statistics', (req, res) => apiController.getReminderStatistics(req, res));

router.post('/process-advances', (req, res) => apiController.processAdvancePayments(req, res));
router.get('/advance-statistics', (req, res) => apiController.getAdvanceStatistics(req, res));
router.post('/create-advance', (req, res) => apiController.createAdvance(req, res));
router.post('/repay-advance', (req, res) => apiController.repayAdvance(req, res));

router.post('/generate-report', (req, res) => apiController.generateReport(req, res));
router.get('/reports', (req, res) => apiController.getReports(req, res));
router.get('/reports/:reportId', (req, res) => apiController.getReportDetail(req, res));
router.get('/export-report', (req, res) => apiController.exportReport(req, res));

router.get('/policies', (req, res) => apiController.getPolicies(req, res));
router.get('/policies/:policyNo', (req, res) => apiController.getPolicyDetail(req, res));

router.get('/visit-records', (req, res) => apiController.getVisitRecords(req, res));
router.post('/visit-records', (req, res) => apiController.createVisitRecord(req, res));

router.get('/config', (req, res) => apiController.getConfig(req, res));
router.post('/config', (req, res) => apiController.updateConfig(req, res));

router.get('/holidays', (req, res) => apiController.getHolidays(req, res));
router.post('/holidays', (req, res) => apiController.addHoliday(req, res));
router.post('/workdays', (req, res) => apiController.addWorkday(req, res));

router.post('/backup', (req, res) => apiController.backupData(req, res));
router.get('/backups', (req, res) => apiController.getBackups(req, res));
router.post('/restore', (req, res) => apiController.restoreBackup(req, res));
router.get('/export', (req, res) => apiController.exportAllData(req, res));

module.exports = router;
