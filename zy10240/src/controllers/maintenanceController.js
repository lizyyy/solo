const PlantRentalService = require('../services/PlantRentalService');
const MaintenanceTask = require('../models/MaintenanceTask');
const HistoryService = require('../utils/history');

exports.createTask = async (req, res, next) => {
  try {
    const { request_id, operated_by, ...data } = req.body;
    const result = await PlantRentalService.createMaintenanceTask(data, request_id, operated_by);
    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

exports.startTask = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const task = await PlantRentalService.startMaintenance(req.params.id, operated_by);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.completeTask = async (req, res, next) => {
  try {
    const { notes, operated_by } = req.body;
    const task = await PlantRentalService.completeMaintenance(req.params.id, notes, operated_by);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.markNeedsRepotting = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const task = await PlantRentalService.markNeedsRepotting(req.params.id, operated_by);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.markNeedsCompensation = async (req, res, next) => {
  try {
    const { operated_by } = req.body;
    const task = await PlantRentalService.markNeedsCompensation(req.params.id, operated_by);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelTask = async (req, res, next) => {
  try {
    const { reason, operated_by } = req.body;
    const task = await PlantRentalService.cancelMaintenance(req.params.id, reason, operated_by);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await MaintenanceTask.getById(req.params.id);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllTasks = async (req, res, next) => {
  try {
    const { status } = req.query;
    const tasks = await MaintenanceTask.getAll(status);
    res.json({
      success: true,
      data: tasks
    });
  } catch (err) {
    next(err);
  }
};

exports.getTaskHistory = async (req, res, next) => {
  try {
    const history = await HistoryService.getHistory(req.params.id, 'maintenance');
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
};
