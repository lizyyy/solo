const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');

router.get('/', applicationController.getAllApplications);
router.post('/', applicationController.createApplication);
router.get('/:id', applicationController.getApplicationById);
router.put('/:id', applicationController.updateApplication);
router.post('/:id/approve', applicationController.approveApplication);
router.post('/:id/reject', applicationController.rejectApplication);
router.post('/:id/admission', applicationController.confirmAdmission);
router.post('/:id/cancel', applicationController.cancelApplication);

module.exports = router;