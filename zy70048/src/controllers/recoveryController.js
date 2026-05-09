const RecoveryService = require('../services/RecoveryService');

exports.startRecovery = async (req, res, next) => {
  try {
    const record = await RecoveryService.startRecovery(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecoveryRecords = async (req, res, next) => {
  try {
    const records = await RecoveryService.getRecoveryByLineStop(req.params.id);
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRecovery = async (req, res, next) => {
  try {
    const record = await RecoveryService.updateRecovery(
      req.params.recoveryId,
      req.body
    );
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

exports.completeRecovery = async (req, res, next) => {
  try {
    const result = await RecoveryService.completeRecovery(
      req.params.recoveryId,
      req.body
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.failRecovery = async (req, res, next) => {
  try {
    const result = await RecoveryService.failRecovery(
      req.params.recoveryId,
      req.body
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
