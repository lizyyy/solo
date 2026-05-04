const express = require('express');
const router = express.Router();
const bookingsController = require('../controllers/bookingsController');
const settlementController = require('../controllers/settlementController');

router.get('/', bookingsController.getAllBookings);
router.get('/:id', bookingsController.getBookingById);
router.post('/', bookingsController.createBooking);
router.put('/:id', bookingsController.updateBooking);

router.post('/:id/cancel', bookingsController.cancelBooking);
router.post('/:id/pay-deposit', bookingsController.payDeposit);
router.post('/:id/check-in', bookingsController.checkIn);
router.post('/:id/start-use', bookingsController.startUse);
router.post('/:id/add-devices', bookingsController.addDevices);
router.post('/:id/remove-devices', bookingsController.removeDevices);

router.post('/:id/extend', settlementController.extendBooking);
router.post('/:id/change-room', settlementController.changeRoom);
router.post('/:id/settlement/preview', settlementController.previewSettlement);
router.post('/:id/settlement/process', settlementController.processSettlement);
router.post('/:id/damage', settlementController.recordDamage);
router.get('/:id/deposits', settlementController.getDepositTransactions);

module.exports = router;
