const express = require('express');
const sampleController = require('../controllers/sampleController');

const router = express.Router();

router.get('/', sampleController.getStatistics.bind(sampleController));

module.exports = router;
