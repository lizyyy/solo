const express = require('express');
const router = express.Router();
const flowController = require('../controllers/flowController');
const { validateReviewer } = require('../middleware/businessRules');

router.get('/', flowController.getAllFlows);
router.get('/:id', flowController.getFlowById);
router.put('/:id/review', validateReviewer, flowController.reviewFlow);

module.exports = router;
