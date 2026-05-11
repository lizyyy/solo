const express = require('express');
const router = express.Router();
const electricityController = require('../controllers/electricity.controller');

router.get('/', electricityController.getAllApprovals);
router.get('/risky', electricityController.getRiskyApprovals);
router.get('/:id', electricityController.getApprovalById);
router.post('/:id/approve', electricityController.approveElectricity);
router.post('/:id/reject', electricityController.rejectElectricity);

module.exports = router;