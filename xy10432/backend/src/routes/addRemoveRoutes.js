const express = require('express');
const router = express.Router();
const addRemoveController = require('../controllers/addRemoveController');

router.post('/add', addRemoveController.addItem);
router.post('/remove', addRemoveController.removeItem);

module.exports = router;
