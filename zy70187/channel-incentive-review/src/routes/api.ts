import { Router } from 'express';
import { TargetSnapshotController } from '../controllers/TargetSnapshotController';
import { AchievementController } from '../controllers/AchievementController';
import { ProtectionPeriodController } from '../controllers/ProtectionPeriodController';
import { CrossRegionAssignmentController } from '../controllers/CrossRegionAssignmentController';
import { DisputeController } from '../controllers/DisputeController';
import { IncentiveCalculationController } from '../controllers/IncentiveCalculationController';
import { auditLogger } from '../utils/AuditLogger';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '渠道激励达标复核服务运行正常',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/logs', (req, res) => {
  const { entityType, entityId } = req.query;
  
  let logs;
  if (entityType && entityId) {
    logs = auditLogger.findByEntity(entityType as string, entityId as string);
  } else {
    logs = auditLogger.findAll();
  }

  res.json({
    success: true,
    data: logs.slice(0, 100)
  });
});

router.get('/logs/:logId', (req, res) => {
  const log = auditLogger.findById(req.params.logId);
  if (!log) {
    return res.status(404).json({
      success: false,
      errorMessage: '日志不存在'
    });
  }
  res.json({ success: true, data: log });
});

router.get('/logs/history/:entityType/:entityId', (req, res) => {
  const history = auditLogger.getEntityHistory(
    req.params.entityType,
    req.params.entityId
  );
  res.json({
    success: true,
    history,
    count: history.length
  });
});

router.post('/target-snapshots', TargetSnapshotController.createSnapshot);
router.post('/target-snapshots/:snapshotId/finalize', TargetSnapshotController.finalizeSnapshot);
router.get('/target-snapshots', TargetSnapshotController.listSnapshots);
router.get('/target-snapshots/:snapshotId', TargetSnapshotController.getSnapshot);
router.get('/target-snapshots/channel/:channelId/:year/:quarter', TargetSnapshotController.getSnapshotByChannel);

router.post('/achievements', AchievementController.createRecord);
router.get('/achievements', AchievementController.listRecords);
router.get('/achievements/:recordId', AchievementController.getRecord);
router.get('/achievements/:recordId/history', AchievementController.getRecordHistory);

router.post('/protections', ProtectionPeriodController.createProtection);
router.post('/protections/:protectionId/approve', ProtectionPeriodController.approveProtection);
router.post('/protections/:protectionId/terminate', ProtectionPeriodController.terminateProtection);
router.get('/protections', ProtectionPeriodController.listProtections);
router.get('/protections/:protectionId', ProtectionPeriodController.getProtection);

router.post('/cross-region', CrossRegionAssignmentController.createAssignment);
router.post('/cross-region/:assignmentId/approve', CrossRegionAssignmentController.approveAssignment);
router.post('/cross-region/:assignmentId/reject', CrossRegionAssignmentController.rejectAssignment);
router.get('/cross-region', CrossRegionAssignmentController.listAssignments);
router.get('/cross-region/:assignmentId', CrossRegionAssignmentController.getAssignment);

router.post('/disputes', DisputeController.raiseDispute);
router.post('/disputes/:disputeId/assign', DisputeController.assignDispute);
router.post('/disputes/:disputeId/start-review', DisputeController.startReview);
router.post('/disputes/:disputeId/request-evidence', DisputeController.requestEvidence);
router.post('/disputes/:disputeId/submit-evidence', DisputeController.submitEvidence);
router.post('/disputes/:disputeId/resolve', DisputeController.resolveDispute);
router.post('/disputes/:disputeId/comments', DisputeController.addComment);
router.get('/disputes', DisputeController.listDisputes);
router.get('/disputes/:disputeId', DisputeController.getDispute);

router.post('/incentives/calculate', IncentiveCalculationController.calculateIncentive);
router.post('/incentives/:incentiveId/approve', IncentiveCalculationController.approveIncentive);
router.post('/incentives/:incentiveId/schedule-payout', IncentiveCalculationController.schedulePayout);
router.post('/incentives/:incentiveId/mark-paid', IncentiveCalculationController.markAsPaid);
router.get('/incentives', IncentiveCalculationController.listIncentives);
router.get('/incentives/:incentiveId', IncentiveCalculationController.getIncentive);
router.get('/incentives/:incentiveId/history', IncentiveCalculationController.getIncentiveHistory);

export default router;
