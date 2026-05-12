const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');

router.post('/', plantController.createPlant);
router.get('/', plantController.getAllPlants);
router.get('/:id', plantController.getPlant);
router.get('/:id/history', plantController.getPlantHistory);
router.get('/location/:locationId', plantController.getByLocation);
router.post('/move', plantController.movePlant);
router.put('/:id/status', plantController.updatePlantStatus);

module.exports = router;
