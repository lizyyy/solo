const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');

router.get('/task/:taskId', materialController.getTaskMaterials);
router.get('/task/:taskId/validation', materialController.getValidationSummary);
router.get('/:materialId', materialController.getMaterial);
router.put('/:materialId', materialController.updateMaterial);
router.post('/:materialId/revalidate', materialController.revalidateMaterial);

module.exports = router;
