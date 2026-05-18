const express = require('express');
const router = express.Router();
const appealController = require('../controllers/appealController');

router.post('/', appealController.create);
router.put('/:id', appealController.update);
router.get('/status', appealController.getStatusList);
router.get('/export', appealController.exportCsv);
router.post('/batch-import', appealController.batchImport);
router.get('/:id', appealController.findById);
router.get('/', appealController.findAll);

module.exports = router;
