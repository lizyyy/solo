const express = require('express');
const lawyerController = require('../controllers/lawyerController');

const router = express.Router();

router.post('/', lawyerController.createLawyer);
router.get('/', lawyerController.getLawyers);
router.post('/assign', lawyerController.assignCase);
router.post('/reassign', lawyerController.reassignCase);
router.get('/reassignments', lawyerController.getReassignments);
router.post('/reassignments/:reassignment_id/follow-up', lawyerController.completeFollowUp);

module.exports = router;
