const express = require('express');
const router = express.Router();
const sealController = require('../controllers/sealController');

router.get('/seals', sealController.getAllSeals);
router.get('/seals/:id', sealController.getSealById);

router.post('/applications', sealController.createApplication);
router.get('/applications', sealController.getAllApplications);
router.get('/applications/:id', sealController.getApplicationById);

router.post('/applications/:applicationId/approve', sealController.approveApplication);
router.post('/applications/:applicationId/reject', sealController.rejectApplication);

router.post('/applications/:applicationId/lend', sealController.lendSeal);
router.post('/applications/:applicationId/return', sealController.returnSeal);

router.get('/overdue', sealController.getOverdueApplications);
router.get('/export', sealController.exportUsageRecords);

module.exports = router;