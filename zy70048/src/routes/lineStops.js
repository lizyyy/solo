const express = require('express');
const router = express.Router();

const lineStopController = require('../controllers/lineStopController');
const reasonController = require('../controllers/reasonController');
const responsibilityController = require('../controllers/responsibilityController');
const recoveryController = require('../controllers/recoveryController');
const reviewController = require('../controllers/reviewController');

const {
  validate,
  lineStopSchema,
  reasonSchema,
  reasonConfirmSchema,
  reasonRejectSchema,
  responsibilitySchema,
  recoveryStartSchema,
  recoveryUpdateSchema,
  recoveryCompleteSchema,
  recoveryFailSchema,
  reportCreateSchema,
  reportUpdateSchema,
  reportSubmitSchema,
  reportApproveSchema,
  reportRejectSchema,
  appealSchema
} = require('../middleware/validation');

router.get('/constants', lineStopController.getConstants);

router.post('/', validate(lineStopSchema), lineStopController.createLineStop);
router.get('/', lineStopController.getLineStops);

router.get('/:id', lineStopController.getLineStop);
router.get('/:id/summary', lineStopController.getLineStopSummary);
router.get('/:id/history', lineStopController.getStatusHistory);

router.post('/:id/reasons', validate(reasonSchema), reasonController.submitReason);
router.get('/:id/reasons', reasonController.getReasons);
router.get('/:id/reasons/conflicts', reasonController.getConflictingReasons);
router.post('/reasons/:reasonId/confirm', validate(reasonConfirmSchema), reasonController.confirmReason);
router.post('/reasons/:reasonId/reject', validate(reasonRejectSchema), reasonController.rejectReason);

router.post('/:id/responsibilities', validate(responsibilitySchema), responsibilityController.assignResponsibility);
router.get('/:id/responsibilities', responsibilityController.getResponsibilities);
router.post('/responsibilities/:responsibilityId/appeal', validate(appealSchema), responsibilityController.appealResponsibility);
router.post('/responsibilities/:responsibilityId/finalize', (req, res, next) => {
  if (!req.body.operator) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '缺少操作人信息' }});
  }
  next();
}, responsibilityController.finalizeResponsibility);

router.post('/:id/recovery', validate(recoveryStartSchema), recoveryController.startRecovery);
router.get('/:id/recovery', recoveryController.getRecoveryRecords);
router.put('/recovery/:recoveryId', validate(recoveryUpdateSchema), recoveryController.updateRecovery);
router.post('/recovery/:recoveryId/complete', validate(recoveryCompleteSchema), recoveryController.completeRecovery);
router.post('/recovery/:recoveryId/fail', validate(recoveryFailSchema), recoveryController.failRecovery);

router.post('/:id/reports', validate(reportCreateSchema), reviewController.createReport);
router.get('/:id/reports', reviewController.getReports);
router.put('/reports/:reportId', validate(reportUpdateSchema), reviewController.updateReport);
router.post('/reports/:reportId/submit', validate(reportSubmitSchema), reviewController.submitReport);
router.post('/reports/:reportId/approve', validate(reportApproveSchema), reviewController.approveReport);
router.post('/reports/:reportId/reject', validate(reportRejectSchema), reviewController.rejectReport);

module.exports = router;
