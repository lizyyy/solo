const express = require('express');
const TaskController = require('../controllers/task.controller');

const router = express.Router();

router.post('/', TaskController.createTask);
router.get('/status', TaskController.getTasksByStatus);
router.get('/:taskId', TaskController.getTask);
router.post('/:taskId/material-requirements', TaskController.submitMaterialRequirement);
router.post('/:taskId/materials', TaskController.submitMaterials);
router.post('/:taskId/send-to-third-party', TaskController.sendToThirdParty);
router.post('/:taskId/callback', TaskController.handleThirdPartyCallback);
router.post('/:taskId/decision', TaskController.makeDecision);
router.post('/:taskId/cancel', TaskController.cancelTask);
router.post('/:taskId/risk-tags', TaskController.addRiskTag);
router.post('/risk-tags/:tagId/resolve', TaskController.resolveRiskTag);

module.exports = router;
