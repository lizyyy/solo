const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const flowController = require('../controllers/flowController');
const exportController = require('../controllers/exportController');
const { getExceptionLogs, resolveException } = require('../utils/exceptionLogger');

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'express-package-station-api', timestamp: new Date().toISOString() });
});

router.post('/packages', asyncHandler(packageController.createPackage));
router.get('/packages', asyncHandler(packageController.getPackages));
router.get('/packages/:id', asyncHandler(packageController.getPackageById));
router.put('/packages/:id/status', asyncHandler(packageController.updatePackageStatus));
router.patch('/packages/:id/correct', asyncHandler(packageController.manualCorrect));

router.post('/reminders', asyncHandler(flowController.createReminder));
router.get('/reminders', asyncHandler(flowController.getReminders));

router.post('/rejections', asyncHandler(flowController.createRejection));
router.get('/rejections', asyncHandler(flowController.getRejections));

router.post('/returns', asyncHandler(flowController.createReturnReport));
router.get('/returns', asyncHandler(flowController.getReturnReports));
router.put('/returns/:id/confirm', asyncHandler(flowController.confirmReturn));

router.get('/export/retention', asyncHandler(exportController.exportRetentionReport));
router.get('/export/exceptions', asyncHandler(exportController.exportExceptionLog));
router.get('/export/files', exportController.getExportFiles);

router.get('/exceptions', asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const logs = await getExceptionLogs(limit, offset);
    res.json({ data: logs });
  } catch (error) {
    res.status(500).json({ error: '查询异常日志失败' });
  }
}));

router.put('/exceptions/:id/resolve', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { handled_by, conclusion } = req.body;
    await resolveException(id, handled_by || '', conclusion || '');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '处理异常失败' });
  }
}));

module.exports = router;
