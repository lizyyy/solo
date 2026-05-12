const express = require('express');
const router = express.Router();
const repottingController = require('../controllers/repottingController');

router.post('/', repottingController.createRecord);
router.get('/', repottingController.getAllRecords);
router.get('/plant/:plantId', repottingController.getByPlant);
router.get('/:id/history', repottingController.getRecordHistory);
router.get('/:id', repottingController.getRecord);

module.exports = router;
