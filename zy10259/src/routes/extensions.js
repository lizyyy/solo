const express = require('express');
const router = express.Router();
const ExtensionController = require('../controllers/extensionController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, ExtensionController.create);
router.post('/:id/approve', ExtensionController.approve);
router.get('/order/:orderId', ExtensionController.getByOrderId);

module.exports = router;
