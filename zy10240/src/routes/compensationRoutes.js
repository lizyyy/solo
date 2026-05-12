const express = require('express');
const router = express.Router();
const compensationController = require('../controllers/compensationController');

router.post('/', compensationController.createCompensation);
router.get('/', compensationController.getAllCompensations);
router.get('/:id', compensationController.getCompensation);
router.get('/:id/history', compensationController.getCompensationHistory);
router.post('/:id/approve', compensationController.approveCompensation);
router.post('/:id/mark-paid', compensationController.markPaid);
router.post('/:id/waive', compensationController.waiveCompensation);

module.exports = router;
