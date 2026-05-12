const Customer = require('../models/Customer');
const Location = require('../models/Location');

exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    res.json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.getById(req.params.id);
    res.json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.getAll();
    res.json({
      success: true,
      data: customers
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    await Customer.update(req.params.id, req.body);
    const customer = await Customer.getById(req.params.id);
    res.json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

exports.createLocation = async (req, res, next) => {
  try {
    const location = await Location.create(req.body);
    res.json({
      success: true,
      data: location
    });
  } catch (err) {
    next(err);
  }
};

exports.getLocation = async (req, res, next) => {
  try {
    const location = await Location.getById(req.params.id);
    res.json({
      success: true,
      data: location
    });
  } catch (err) {
    next(err);
  }
};

exports.getLocationsByCustomer = async (req, res, next) => {
  try {
    const locations = await Location.getByCustomer(req.params.customerId);
    res.json({
      success: true,
      data: locations
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllLocations = async (req, res, next) => {
  try {
    const locations = await Location.getAll();
    res.json({
      success: true,
      data: locations
    });
  } catch (err) {
    next(err);
  }
};
