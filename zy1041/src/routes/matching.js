const express = require('express');
const MatchingController = require('../controllers/matchingController');

const router = express.Router();

router.get('/score', MatchingController.calculateMatchScore);
router.get('/request/:request_id', MatchingController.matchRequestToTrips);
router.get('/trip/:trip_id', MatchingController.matchTripToRequests);

module.exports = router;
