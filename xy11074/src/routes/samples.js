const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');

router.post('/', sampleController.createSample.bind(sampleController));
router.put('/:sampleId', sampleController.updateSample.bind(sampleController));
router.get('/:sampleId', sampleController.getSample.bind(sampleController));
router.get('/', sampleController.getSamples.bind(sampleController));
router.post('/batch/import', sampleController.batchImport.bind(sampleController));
router.get('/:sampleId/check-old-design', sampleController.checkOldDesignNewOrder.bind(sampleController));
router.get('/:sampleId/check-tracker', sampleController.checkTrackerConsistency.bind(sampleController));
router.get('/:sampleId/next-steps', sampleController.getNextSteps.bind(sampleController));
router.get('/export/download', sampleController.exportSamples.bind(sampleController));

module.exports = router;