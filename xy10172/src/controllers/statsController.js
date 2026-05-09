const statsService = require('../services/statsService');
const callbackService = require('../services/callbackService');

async function getContractStats(req, res, next) {
  try {
    const { startDate, endDate, initiatorId } = req.query;

    const stats = await statsService.getContractStats({
      startDate,
      endDate,
      initiatorId
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    const stats = await statsService.getDashboardStats({
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

async function getMonthlyTrend(req, res, next) {
  try {
    const { months = 6 } = req.query;

    const trend = await statsService.getMonthlyTrend(parseInt(months));

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    next(error);
  }
}

async function getInitiatorStats(req, res, next) {
  try {
    const { limit = 10 } = req.query;

    const stats = await statsService.getInitiatorStats({
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

async function getProcessingTimeStats(req, res, next) {
  try {
    const stats = await statsService.getProcessingTimeStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

async function getFullStats(req, res, next) {
  try {
    const { startDate, endDate, initiatorId, months = 6 } = req.query;

    const [contractStats, dashboard, trend, initiators, processingTime, callbackStats] = await Promise.all([
      statsService.getContractStats({ startDate, endDate, initiatorId }),
      statsService.getDashboardStats({ startDate, endDate }),
      statsService.getMonthlyTrend(parseInt(months)),
      statsService.getInitiatorStats({ limit: 10 }),
      statsService.getProcessingTimeStats(),
      callbackService.getCallbackStats()
    ]);

    res.json({
      success: true,
      data: {
        contracts: contractStats,
        dashboard,
        monthlyTrend: trend,
        topInitiators: initiators,
        processingTime,
        callbacks: callbackStats
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContractStats,
  getDashboardStats,
  getMonthlyTrend,
  getInitiatorStats,
  getProcessingTimeStats,
  getFullStats
};
