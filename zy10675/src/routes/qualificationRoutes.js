const express = require('express');
const { qualificationController, upload } = require('../controllers/qualificationController');

const router = express.Router();

router.post('/', qualificationController.create);
router.put('/:id', qualificationController.update);
router.post('/:id/review', qualificationController.review);
router.post('/:id/revoke', qualificationController.revoke);
router.get('/', qualificationController.list);
router.get('/:id', qualificationController.detail);
router.get('/export/data', qualificationController.export);
router.post('/import/batch', upload.single('file'), qualificationController.batchImport);

module.exports = router;
