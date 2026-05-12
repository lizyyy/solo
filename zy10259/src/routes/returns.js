const express = require('express');
const router = express.Router();
const ReturnController = require('../controllers/returnController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, ReturnController.create);
router.post('/:id/confirm', ReturnController.confirm);
router.get('/:id', ReturnController.getById);

module.exports = router;
