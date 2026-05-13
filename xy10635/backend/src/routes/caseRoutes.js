const express = require('express');
const caseController = require('../controllers/caseController');

const router = express.Router();

router.post('/', caseController.createCase);
router.get('/', caseController.getCases);
router.get('/statistics', caseController.getStatistics);
router.get('/lead-funnel', caseController.getLeadFunnel);
router.get('/export', caseController.exportCases);
router.get('/:id', caseController.getCaseById);
router.put('/:id', caseController.updateCase);
router.post('/:id/change-status', caseController.changeCaseStatus);
router.post('/:id/check-conflict', caseController.checkConflict);

module.exports = router;
