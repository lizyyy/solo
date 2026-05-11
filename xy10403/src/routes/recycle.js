const express = require('express');
const recycleController = require('../controllers/recycleController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/execute', authenticateToken, requireRole(['admin']), recycleController.manualRecycle);

module.exports = router;
