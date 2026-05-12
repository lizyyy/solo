const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');

router.post('/', inspectionController.createInspection);
router.get('/', inspectionController.getInspections);
router.get('/:id', inspectionController.getInspection);
router.post('/:id/deductions', inspectionController.createDeduction);
router.get('/deductions/list', inspectionController.getDeductions);

module.exports = router;
