const express = require('express');
const router = express.Router();
const rectificationController = require('../controllers/rectificationController');

router.post('/', rectificationController.createRectification);
router.get('/', rectificationController.getRectifications);
router.put('/:id/submit', rectificationController.submitRectification);
router.post('/:id/reviews', rectificationController.createReview);
router.get('/reviews/list', rectificationController.getReviews);

module.exports = router;
