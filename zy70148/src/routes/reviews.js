const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/:request_id', reviewController.createReview);
router.get('/:request_id', reviewController.getReviewsByRequest);
router.get('/', reviewController.getPendingReviews);

module.exports = router;