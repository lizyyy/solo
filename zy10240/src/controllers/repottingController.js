const PlantRentalService = require('../services/PlantRentalService');
const RepottingRecord = require('../models/RepottingRecord');
const HistoryService = require('../utils/history');

exports.createRecord = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.createRepottingRecord(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.getRecord = async (req, res, next) => {
  try {
    const record = await RepottingRecord.getById(req.params.id);
    res.json({
      success: true,
      data: record
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllRecords = async (req, res, next) => {
  try {
    const records = await RepottingRecord.getAll();
    res.json({
      success: true,
      data: records
    });
  } catch (err) {
    next(err);
  }
};

exports.getByPlant = async (req, res, next) => {
  try {
    const records = await RepottingRecord.getByPlant(req.params.plantId);
    res.json({
      success: true,
      data: records
    });
  } catch (err) {
    next(err);
  }
};

exports.getRecordHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'repotting');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};
