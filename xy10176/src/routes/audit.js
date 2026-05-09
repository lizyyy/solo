const express = require('express');
const sampleController = require('../controllers/sampleController');

const router = express.Router();

router.get('/', sampleController.queryAudits.bind(sampleController));

module.exports = router;
