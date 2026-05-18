const express = require('express');
const { CompensationController, upload } = require('../controllers/CompensationController');

const router = express.Router();

router.post('/', CompensationController.create);
router.get('/:compensation_no', CompensationController.get);
router.get('/', CompensationController.list);
router.put('/:compensation_no', CompensationController.update);
router.get('/export/csv', CompensationController.exportCSV);
router.post('/import/csv', upload.single('file'), CompensationController.importCSV);

module.exports = router;
