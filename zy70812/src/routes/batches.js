const express = require('express');
const router = express.Router();
const { createBatch, listBatches, getBatch } = require('../controllers/batchController');

router.post('/', createBatch);
router.get('/', listBatches);
router.get('/:id', getBatch);

module.exports = router;
