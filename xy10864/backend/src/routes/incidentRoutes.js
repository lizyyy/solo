const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');

router.post('/', incidentController.createIncident);
router.get('/', incidentController.getIncidents);
router.get('/:id', incidentController.getIncidentById);
router.patch('/:id/status', incidentController.updateIncidentStatus);
router.post('/:id/timeline', incidentController.addTimeline);
router.post('/:id/evidence', incidentController.addEvidence);
router.post('/:id/affected-interface', incidentController.addAffectedInterface);
router.post('/:id/action-item', incidentController.addActionItem);
router.patch('/:id/action-item/:actionItemId/status', incidentController.updateActionItemStatus);
router.post('/:id/review-conclusion', incidentController.setReviewConclusion);
router.post('/:id/compensation', incidentController.addCompensation);
router.post('/:id/failure-reason', incidentController.addFailureReason);
router.get('/:id/export', incidentController.exportIncident);
router.get('/:id/timeline-summary', incidentController.getTimelineSummary);

module.exports = router;
