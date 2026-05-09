const ReasonService = require('../services/ReasonService');

exports.submitReason = async (req, res, next) => {
  try {
    const reason = await ReasonService.submitReason(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: reason
    });
  } catch (error) {
    next(error);
  }
};

exports.getReasons = async (req, res, next) => {
  try {
    const reasons = await ReasonService.getReasonsByLineStop(req.params.id);
    res.json({
      success: true,
      data: reasons
    });
  } catch (error) {
    next(error);
  }
};

exports.confirmReason = async (req, res, next) => {
  try {
    const result = await ReasonService.confirmReason(
      req.params.reasonId,
      req.body.operator,
      req.body.isPrimary
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectReason = async (req, res, next) => {
  try {
    const result = await ReasonService.rejectReason(
      req.params.reasonId,
      req.body.operator,
      req.body.rejectReason
    );
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getConflictingReasons = async (req, res, next) => {
  try {
    const result = await ReasonService.getConflictingReasons(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
