const Plant = require('../models/Plant');
const PlantRentalService = require('../services/PlantRentalService');
const HistoryService = require('../utils/history');

exports.createPlant = async (req, res, next) => {
  try {
    const plant = await Plant.create(req.body);
    res.json({
      success: true,
      data: plant
    });
  } catch (err) {
    next(err);
  }
};

exports.getPlant = async (req, res, next) => {
  try {
    const plant = await Plant.getById(req.params.id);
    res.json({
      success: true,
      data: plant
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllPlants = async (req, res, next) => {
  try {
    const plants = await Plant.getAll();
    res.json({
      success: true,
      data: plants
    });
  } catch (err) {
    next(err);
  }
};

exports.getByLocation = async (req, res, next) => {
  try {
    const plants = await Plant.getByLocation(req.params.locationId);
    res.json({
      success: true,
      data: plants
    });
  } catch (err) {
    next(err);
  }
};

exports.movePlant = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.movePlant(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.getPlantHistory = async (req, res, next) => {
  try {
    const history = await PlantRentalService.getPlantHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePlantStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    await Plant.updateStatus(req.params.id, status);
    const plant = await Plant.getById(req.params.id);
    res.json({
      success: true,
      data: plant
    });
  } catch (err) {
    next(err);
  }
};
