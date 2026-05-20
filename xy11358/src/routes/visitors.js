const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/visitorController');

router.post('/', visitorController.createVisitor);
router.get('/', visitorController.getVisitors);
router.get('/:id', visitorController.getVisitor);
router.post('/:id/approve', visitorController.approveVisitor);
router.post('/:id/reject', visitorController.rejectVisitor);

router.post('/plates', visitorController.createTemporaryPlate);
router.get('/plates', visitorController.getTemporaryPlates);

router.post('/blacklist', visitorController.addToBlacklist);
router.get('/blacklist', visitorController.getBlacklist);
router.post('/blacklist/:id/remove', visitorController.removeFromBlacklist);

module.exports = router;
