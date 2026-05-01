const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvController = require('../controllers/csvController');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/export/today', csvController.exportTodayOrders);
router.post('/import', upload.single('file'), csvController.importOrders);

module.exports = router;
