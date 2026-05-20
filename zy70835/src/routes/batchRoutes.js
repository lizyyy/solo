const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/batchController');

router.post('/', BatchController.create);
router.get('/:id', BatchController.getById);
router.get('/no/:batch_no', BatchController.getByNo);
router.get('/', BatchController.list);

module.exports = router;