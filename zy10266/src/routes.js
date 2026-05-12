const express = require('express');
const router = express.Router();

const roomController = require('./controllers/rooms');
const studentController = require('./controllers/students');
const bookingController = require('./controllers/bookings');

router.get('/rooms', roomController.getRooms);
router.get('/rooms/:id', roomController.getRoomById);
router.get('/rooms/:id/devices', roomController.getRoomDevices);

router.get('/students', studentController.getStudents);
router.get('/students/:id', studentController.getStudentById);
router.get('/students/:id/credit', studentController.getStudentCreditScore);

router.get('/bookings', bookingController.getBookings);
router.get('/bookings/:id', bookingController.getBookingById);
router.post('/bookings', bookingController.createBooking);
router.post('/bookings/:id/members', bookingController.addBookingMember);
router.post('/bookings/:id/cancel', bookingController.cancelBooking);
router.post('/bookings/:id/checkin', bookingController.checkIn);
router.post('/bookings/:id/no-show', bookingController.processNoShow);

module.exports = router;