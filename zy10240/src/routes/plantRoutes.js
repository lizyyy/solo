const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');

router.post('/', plantController.createPlant);
router.get('/', plantController.getAllPlants);
router.get('/location/:locationId', plantController.getByLocation);
router.post('/move', plantController.movePlant);
router.get('/:id/history', plantController.getPlantHistory);
router.put('/:id/status', plantController.updatePlantStatus);
router.get('/:id', plantController.getPlant);

module.exports = router;
