const express = require('express');
const router = express.Router();
const witheringController = require('../controllers/witheringController');

router.post('/', witheringController.createTreatment);
router.get('/', witheringController.getAllTreatments);
router.get('/plant/:plantId', witheringController.getByPlant);
router.get('/:id/history', witheringController.getTreatmentHistory);
router.get('/:id', witheringController.getTreatment);

module.exports = router;
