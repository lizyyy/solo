const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.post('/', customerController.createCustomer);
router.get('/', customerController.getAllCustomers);

router.post('/locations', customerController.createLocation);
router.get('/locations', customerController.getAllLocations);
router.get('/locations/:id', customerController.getLocation);

router.get('/:customerId/locations', customerController.getLocationsByCustomer);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);

module.exports = router;
