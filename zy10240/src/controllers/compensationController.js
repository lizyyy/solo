const PlantRentalService = require('../services/PlantRentalService');
const Compensation = require('../models/Compensation');
const HistoryService = require('../utils/history');

exports.createCompensation = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.createCompensation(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.approveCompensation = async (req, res, next) => {
  try {
    const { approved_by, notes } = req.body;
    const compensation = await PlantRentalService.approveCompensation(req.params.id, approved_by, notes);
    res.json({
      success: true,
      data: compensation
    });
  } catch (err) {
    next(err);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const compensation = await PlantRentalService.markCompensationPaid(req.params.id, operated_by);
    res.json({
      success: true,
      data: compensation
    });
  } catch (err) {
    next(err);
  }
};

exports.waiveCompensation = async (req, res, next) => {
  try {
    const { reason, operated_by } = req.body;
    const compensation = await PlantRentalService.waiveCompensation(req.params.id, reason, operated_by);
    res.json({
      success: true,
      data: compensation
    });
  } catch (err) {
    next(err);
  }
};

exports.getCompensation = async (req, res, next) => {
  try {
    const compensation = await Compensation.getById(req.params.id);
    res.json({
      success: true,
      data: compensation
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllCompensations = async (req, res, next) => {
  try {
    const { status } = req.query;
    const compensations = await Compensation.getAll(status);
    res.json({
      success: true,
      data: compensations
    });
  } catch (err) {
    next(err);
  }
};

exports.getCompensationHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'compensation');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};
