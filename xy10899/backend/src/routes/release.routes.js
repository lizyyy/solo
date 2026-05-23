const express = require('express');
const router = express.Router();
const releaseController = require('../controllers/release.controller');

router.post('/', releaseController.createRelease);
router.get('/', releaseController.getReleases);
router.get('/:id', releaseController.getReleaseDetail);
router.put('/:releaseId/check-items/:checkItemId/status', releaseController.updateCheckItemStatus);
router.put('/:releaseId/check-items/:checkItemId/assignee', releaseController.updateCheckItemAssignee);
router.post('/:releaseId/check-items/:checkItemId/compensate', releaseController.compensateCheckItem);
router.post('/:releaseId/blocks', releaseController.addBlockReason);
router.put('/blocks/:blockId/resolve', releaseController.resolveBlockReason);
router.post('/:releaseId/exemptions', releaseController.applyExemption);
router.put('/exemptions/:exemptionId/approve', releaseController.approveExemption);
router.put('/:releaseId/status', releaseController.updateReleaseStatus);
router.get('/:id/export', releaseController.exportRelease);
router.get('/:id/export/detail', releaseController.exportReleaseDetail);

module.exports = router;
