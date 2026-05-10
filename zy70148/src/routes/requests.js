const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.post('/', requestController.createRequest);
router.get('/', requestController.listRequests);
router.get('/:id', requestController.getRequest);
router.put('/:id', requestController.updateRequest);
router.post('/:id/submit-review', requestController.submitForReview);
router.post('/:id/manual-status', requestController.manualStatusCorrection);

module.exports = router;