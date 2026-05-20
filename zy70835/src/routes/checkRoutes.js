const express = require('express');
const router = express.Router();
const CheckController = require('../controllers/checkController');

router.post('/', CheckController.create);
router.get('/types', CheckController.getTypes);
router.get('/:id', CheckController.getById);
router.put('/:id/status', CheckController.updateStatus);
router.post('/:id/review', CheckController.triggerReview);
router.put('/:id/followup', CheckController.updateFollowUp);
router.get('/class/:class_name', CheckController.getByClass);

module.exports = router;