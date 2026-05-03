const express = require('express');
const TripController = require('../controllers/tripController');

const router = express.Router();

router.post('/', TripController.createTrip);
router.get('/', TripController.listTrips);
router.get('/:id', TripController.getTrip);

module.exports = router;
