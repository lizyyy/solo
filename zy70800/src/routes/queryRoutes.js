const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

router.get('/doctor-confirmed', queryController.getDoctorConfirmed);
router.get('/nurse-forwarded', queryController.getNurseForwarded);
router.get('/director-reviewed', queryController.getDirectorReviewed);
router.get('/audit-trail/:critical_value_id', queryController.getAuditTrail);
router.get('/statistics', queryController.getStatistics);

module.exports = router;
