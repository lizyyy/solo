const express = require('express');
const router = express.Router();
const teamChangeController = require('../controllers/teamChangeController');

router.post('/', teamChangeController.createApplication);
router.put('/:id', teamChangeController.updateApplication);
router.post('/:id/submit', teamChangeController.submitApplication);
router.post('/:id/withdraw', teamChangeController.withdrawApplication);
router.post('/:id/manual-process', teamChangeController.startManualProcessing);
router.post('/:id/remark', teamChangeController.addRemark);
router.post('/:id/approve', teamChangeController.approveApplication);
router.post('/:id/reject', teamChangeController.rejectApplication);
router.post('/:id/sync-insurance', teamChangeController.syncInsuranceList);
router.post('/:id/check-team-consistency', teamChangeController.checkTeamConsistency);
router.get('/', teamChangeController.getApplicationList);
router.get('/:id', teamChangeController.getApplicationDetail);
router.get('/:id/history', teamChangeController.getApplicationHistory);

module.exports = router;
