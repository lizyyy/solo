const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customersController');

router.get('/', customersController.getAllCustomers);
router.get('/:id', customersController.getCustomerById);
router.get('/:id/bookings', customersController.getCustomerBookings);
router.post('/', customersController.createCustomer);
router.put('/:id', customersController.updateCustomer);
router.delete('/:id', customersController.deleteCustomer);

module.exports = router;
