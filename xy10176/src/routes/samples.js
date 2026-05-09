const express = require('express');
const sampleController = require('../controllers/sampleController');

const router = express.Router();

router.post('/', sampleController.createSample.bind(sampleController));
router.get('/:barcode', sampleController.getSample.bind(sampleController));
router.get('/', sampleController.querySamples.bind(sampleController));

router.post('/collect', sampleController.collect.bind(sampleController));
router.post('/centrifuge', sampleController.centrifuge.bind(sampleController));
router.post('/test', sampleController.test.bind(sampleController));
router.post('/review', sampleController.review.bind(sampleController));

router.post('/exception', sampleController.reportException.bind(sampleController));
router.post('/exception/resolve', sampleController.resolveException.bind(sampleController));

module.exports = router;
