const callbackService = require('../services/callbackService');
const auditService = require('../services/auditService');

function extractOperator(req) {
  return {
    id: req.headers['x-user-id'] || 'system',
    name: req.headers['x-user-name'] || 'System',
    email: req.headers['x-user-email'] || 'system@example.com',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
}

function extractRequestId(req) {
  return req.headers['x-request-id'] || null;
}

async function getContractCallbacks(req, res, next) {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 50, event, status } = req.query;

    const result = await callbackService.getContractCallbacks(contractId, {
      page: parseInt(page),
      limit: parseInt(limit),
      event,
      status
    });

    res.json({
      success: true,
      data: result.callbacks,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function getCallbackStatus(req, res, next) {
  try {
    const { callbackId } = req.params;
    const callback = await callbackService.getCallbackStatus(callbackId);

    if (!callback) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '回调记录不存在'
        }
      });
    }

    res.json({
      success: true,
      data: callback
    });
  } catch (error) {
    next(error);
  }
}

async function retryFailedCallbacks(req, res, next) {
  try {
    const result = await callbackService.retryFailedCallbacks();

    res.json({
      success: true,
      data: result,
      message: `已重试 ${result.total} 个回调`
    });
  } catch (error) {
    next(error);
  }
}

async function manualRetryCallback(req, res, next) {
  try {
    const { callbackId } = req.params;
    const result = await callbackService.manualRetryCallback(callbackId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getExhaustedCallbacks(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await callbackService.getExhaustedCallbacks({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.callbacks,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function triggerCompensation(req, res, next) {
  try {
    const { callbackId } = req.params;
    const operator = extractOperator(req);
    const requestId = extractRequestId(req);

    const result = await callbackService.triggerCompensationForExhaustedCallback(
      callbackId,
      operator.id,
      requestId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getCallbackStats(req, res, next) {
  try {
    const stats = await callbackService.getCallbackStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContractCallbacks,
  getCallbackStatus,
  retryFailedCallbacks,
  manualRetryCallback,
  getExhaustedCallbacks,
  triggerCompensation,
  getCallbackStats
};
