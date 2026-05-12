const express = require('express');
const router = express.Router();
const stallController = require('../controllers/stallController');

router.post('/', stallController.createStall);
router.get('/', stallController.getStalls);
router.get('/:id', stallController.getStall);
router.put('/:id', stallController.updateStall);
router.delete('/:id', stallController.deleteStall);

module.exports = router;
