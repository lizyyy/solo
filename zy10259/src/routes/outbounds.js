const express = require('express');
const router = express.Router();
const OutboundController = require('../controllers/outboundController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, OutboundController.create);
router.post('/:id/confirm', OutboundController.confirm);
router.get('/:id', OutboundController.getById);

module.exports = router;
