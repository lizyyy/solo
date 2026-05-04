const express = require('express');
const router = express.Router();
const roomsController = require('../controllers/roomsController');

router.get('/', roomsController.getAllRooms);
router.get('/:id', roomsController.getRoomById);
router.get('/:id/availability', roomsController.getRoomAvailability);
router.post('/', roomsController.createRoom);
router.put('/:id', roomsController.updateRoom);
router.delete('/:id', roomsController.deleteRoom);

module.exports = router;
