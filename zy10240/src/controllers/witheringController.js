const PlantRentalService = require('../services/PlantRentalService');
const WitheringTreatment = require('../models/WitheringTreatment');
const HistoryService = require('../utils/history');

exports.createTreatment = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.createWitheringTreatment(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.getTreatment = async (req, res, next) => {
  try {
    const treatment = await WitheringTreatment.getById(req.params.id);
    res.json({
      success: true,
      data: treatment
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllTreatments = async (req, res, next) => {
  try {
    const treatments = await WitheringTreatment.getAll();
    res.json({
      success: true,
      data: treatments
    });
  } catch (err) {
    next(err);
  }
};

exports.getByPlant = async (req, res, next) => {
  try {
    const treatments = await WitheringTreatment.getByPlant(req.params.plantId);
    res.json({
      success: true,
      data: treatments
    });
  } catch (err) {
    next(err);
  }
};

exports.getTreatmentHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'withering');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};
