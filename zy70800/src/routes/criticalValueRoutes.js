const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const criticalValueController = require('../controllers/criticalValueController');

router.post('/import', upload.single('file'), criticalValueController.importCSV);
router.get('/', criticalValueController.getCriticalValues);
router.get('/:id', criticalValueController.getCriticalValueById);
router.post('/:id/process', criticalValueController.processCriticalValue);
router.post('/:id/handover-gap', criticalValueController.markHandoverGap);

module.exports = router;
