const express = require('express');
const router = express.Router();
const followupController = require('./controllers/followup');

router.post('/followup', followupController.create);
router.put('/followup/:id', followupController.update);
router.get('/followup', followupController.list);
router.get('/followup/:id', followupController.get);
router.get('/followup/export/csv', followupController.exportCsv);
router.post('/followup/batch-import', followupController.batchImport);

module.exports = router;
