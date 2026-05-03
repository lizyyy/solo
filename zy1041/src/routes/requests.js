const express = require('express');
const RequestController = require('../controllers/requestController');

const router = express.Router();

router.post('/', RequestController.createRequest);
router.get('/', RequestController.listRequests);
router.get('/:id', RequestController.getRequest);

module.exports = router;
