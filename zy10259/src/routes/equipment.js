const express = require('express');
const router = express.Router();
const EquipmentController = require('../controllers/equipmentController');
const getIdempotencyMiddleware = require('../middleware/idempotency');

const idempotency = getIdempotencyMiddleware();

router.post('/', idempotency, EquipmentController.create);
router.get('/:id', EquipmentController.getById);
router.get('/', EquipmentController.list);

module.exports = router;
