const express = require('express');
const router = express.Router();
const { importRecords, getImportedRecords, updateWithRemark } = require('../controllers/importController');

router.post('/import', importRecords);
router.get('/records', getImportedRecords);
router.patch('/records/:supplementId/remark', updateWithRemark);

module.exports = router;
