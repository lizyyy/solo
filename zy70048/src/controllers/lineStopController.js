const LineStopService = require('../services/LineStopService');
const StatusMachineService = require('../services/StatusMachineService');
const { STATUS, STATUS_DESCRIPTIONS } = require('../utils/constants');

exports.createLineStop = async (req, res, next) => {
  try {
    const lineStop = await LineStopService.createLineStop(req.body);
    res.status(201).json({
      success: true,
      data: {
        lineStop,
        currentStatus: {
          code: lineStop.status,
          description: STATUS_DESCRIPTIONS[lineStop.status]
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLineStops = async (req, res, next) => {
  try {
    const result = await LineStopService.getLineStops(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getLineStop = async (req, res, next) => {
  try {
    const lineStop = await LineStopService.getLineStopById(req.params.id);
    res.json({
      success: true,
      data: {
        lineStop: lineStop.toJSON(),
        allowedTransitions: StatusMachineService.getAllowedTransitions(lineStop.status)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLineStopSummary = async (req, res, next) => {
  try {
    const summary = await LineStopService.getSummary(req.params.id);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

exports.getStatusHistory = async (req, res, next) => {
  try {
    const history = await LineStopService.getStatusHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

exports.getConstants = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        statuses: Object.values(STATUS).map(status => ({
          code: status,
          description: STATUS_DESCRIPTIONS[status],
          allowedTransitions: StatusMachineService.getAllowedTransitions(status)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
