const CallbackRecord = require('../models/CallbackRecord');
const Contract = require('../models/Contract');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const auditService = require('./auditService');

const CALLBACK_STATUS = CallbackRecord.getStatuses();
const CALLBACK_EVENTS = CallbackRecord.getEvents();

function generateCallbackId() {
  return `CBK-${uuidv4().slice(0, 8).toUpperCase()}-${Date.now()}`;
}

function generateDeduplicationKey(contractId, event, payload) {
  const payloadHash = JSON.stringify(payload);
  return `${contractId}-${event}-${Buffer.from(payloadHash).toString('base64').slice(0, 20)}`;
}

async function createCallbackRecord(contract, event, payload, options = {}) {
  const {
    callbackUrl = contract.callbackUrl,
    maxAttempts = 5,
    retryStrategy = 'exponential',
    retryInterval = 60000,
    operationId
  } = options;

  if (!callbackUrl) {
    throw new Error('回调URL不能为空');
  }

  const deduplicationKey = generateDeduplicationKey(contract._id, event, payload);

  const existingCallback = await CallbackRecord.findOne({ deduplicationKey, status: CALLBACK_STATUS.SUCCESS });

  if (existingCallback) {
    return {
      isDuplicate: true,
      callbackRecord: existingCallback,
      message: '检测到重复回调，已存在成功记录'
    };
  }

  const callbackRecord = new CallbackRecord({
    callbackId: generateCallbackId(),
    eventId: uuidv4(),
    contractId: contract._id,
    contractNo: contract.contractNo,
    version: contract.currentVersion,
    event,
    callbackUrl,
    payload,
    status: CALLBACK_STATUS.PENDING,
    attemptCount: 0,
    maxAttempts,
    retryStrategy,
    retryInterval,
    deduplicationKey,
    operationId
  });

  await callbackRecord.save();

  return {
    isDuplicate: false,
    callbackRecord,
    message: '回调记录已创建'
  };
}

async function executeCallback(callbackRecord) {
  try {
    await callbackRecord.markProcessing();

    const response = await axios.post(callbackRecord.callbackUrl, callbackRecord.payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Id': callbackRecord.callbackId,
        'X-Event-Id': callbackRecord.eventId,
        'X-Contract-Id': callbackRecord.contractId
      },
      timeout: 30000
    });

    await callbackRecord.markSuccess(response);

    await auditService.logCallbackSuccess(callbackRecord, null);

    return {
      success: true,
      callbackId: callbackRecord.callbackId,
      response: response.data
    };
  } catch (error) {
    const shouldRetry = !error.response || (error.response.status >= 500);
    
    await callbackRecord.markFailed(error, shouldRetry);

    await auditService.logCallbackFailed(callbackRecord, error, null);

    if (shouldRetry && callbackRecord.canRetry()) {
      await auditService.logCallbackRetry(callbackRecord, null);
    }

    return {
      success: false,
      callbackId: callbackRecord.callbackId,
      error: error.message,
      shouldRetry,
      nextRetryAt: callbackRecord.nextRetryAt
    };
  }
}

async function createAndExecuteCallback(contract, event, payload, options = {}) {
  if (!contract.callbackUrl && !options.callbackUrl) {
    return {
      success: false,
      skipped: true,
      message: '未配置回调URL，跳过回调'
    };
  }

  const result = await createCallbackRecord(contract, event, payload, options);

  if (result.isDuplicate) {
    return {
      success: true,
      isDuplicate: true,
      callbackId: result.callbackRecord.callbackId,
      message: result.message
    };
  }

  const executionResult = await executeCallback(result.callbackRecord);
  return executionResult;
}

async function retryFailedCallbacks() {
  const now = new Date();

  const pendingCallbacks = await CallbackRecord.find({
    status: { $in: [CALLBACK_STATUS.RETRYING, CALLBACK_STATUS.PENDING] },
    nextRetryAt: { $lte: now },
    isDuplicate: false
  }).sort({ createdAt: 1 });

  const results = [];

  for (const callbackRecord of pendingCallbacks) {
    const result = await executeCallback(callbackRecord);
    results.push(result);
  }

  return {
    total: pendingCallbacks.length,
    results
  };
}

async function getExhaustedCallbacks(options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [callbacks, total] = await Promise.all([
    CallbackRecord.find({ status: CALLBACK_STATUS.EXHAUSTED })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CallbackRecord.countDocuments({ status: CALLBACK_STATUS.EXHAUSTED })
  ]);

  return {
    callbacks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function manualRetryCallback(callbackId) {
  const callbackRecord = await CallbackRecord.findOne({ callbackId });

  if (!callbackRecord) {
    throw new Error(`回调记录不存在: ${callbackId}`);
  }

  callbackRecord.attemptCount = 0;
  callbackRecord.nextRetryAt = new Date();

  await callbackRecord.save();

  return executeCallback(callbackRecord);
}

async function checkDuplicateCallback(deduplicationKey) {
  const existingCallback = await CallbackRecord.findOne({
    deduplicationKey,
    status: { $in: [CALLBACK_STATUS.SUCCESS, CALLBACK_STATUS.PROCESSING] }
  });

  if (existingCallback) {
    return {
      isDuplicate: true,
      callbackId: existingCallback.callbackId,
      status: existingCallback.status,
      processedAt: existingCallback.processedAt
    };
  }

  return { isDuplicate: false };
}

async function getContractCallbacks(contractId, options = {}) {
  const { page = 1, limit = 50, event, status } = options;
  const skip = (page - 1) * limit;

  const query = { contractId };

  if (event) {
    query.event = event;
  }

  if (status) {
    query.status = status;
  }

  const [callbacks, total] = await Promise.all([
    CallbackRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CallbackRecord.countDocuments(query)
  ]);

  return {
    callbacks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function getCallbackStatus(callbackId) {
  return CallbackRecord.findOne({ callbackId }).lean();
}

async function triggerCompensationForExhaustedCallback(callbackId, userId, requestId) {
  const callbackRecord = await CallbackRecord.findOne({ callbackId });

  if (!callbackRecord) {
    throw new Error(`回调记录不存在: ${callbackId}`);
  }

  if (callbackRecord.status !== CALLBACK_STATUS.EXHAUSTED) {
    throw new Error('只有耗尽重试次数的回调才能触发补偿');
  }

  const compensationOperationId = auditService.generateOperationId();

  callbackRecord.compensationStatus = 'in_progress';
  callbackRecord.compensationOperationId = compensationOperationId;
  await callbackRecord.save();

  await auditService.logCompensation(
    callbackRecord._id,
    { id: userId },
    requestId,
    compensationOperationId
  );

  const contract = await Contract.findById(callbackRecord.contractId);

  if (contract) {
    const previousState = { status: contract.previousStatus };
    contract.status = contract.previousStatus || contract.status;
    await contract.save();

    await auditService.logStatusChange(contract, { id: userId }, requestId, previousState);
  }

  callbackRecord.compensationStatus = 'completed';
  callbackRecord.status = CALLBACK_STATUS.COMPENSATED;
  await callbackRecord.save();

  return {
    success: true,
    callbackId,
    compensationOperationId,
    message: '补偿操作已完成'
  };
}

async function getCallbackStats() {
  const stats = await CallbackRecord.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const eventStats = await CallbackRecord.aggregate([
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await CallbackRecord.countDocuments();
  const successCount = await CallbackRecord.countDocuments({ status: CALLBACK_STATUS.SUCCESS });
  const failedCount = await CallbackRecord.countDocuments({
    status: { $in: [CALLBACK_STATUS.FAILED, CALLBACK_STATUS.EXHAUSTED] }
  });

  return {
    total,
    successCount,
    failedCount,
    successRate: total > 0 ? ((successCount / total) * 100).toFixed(2) : '0.00',
    byStatus: stats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byEvent: eventStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
}

module.exports = {
  generateCallbackId,
  generateDeduplicationKey,
  createCallbackRecord,
  executeCallback,
  createAndExecuteCallback,
  retryFailedCallbacks,
  getExhaustedCallbacks,
  manualRetryCallback,
  checkDuplicateCallback,
  getContractCallbacks,
  getCallbackStatus,
  triggerCompensationForExhaustedCallback,
  getCallbackStats,
  CALLBACK_STATUS,
  CALLBACK_EVENTS
};
