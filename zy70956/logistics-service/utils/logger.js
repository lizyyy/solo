const { v4: uuidv4 } = require('uuid');
const { ProcessLog } = require('../models');

async function writeProcessLog({
  targetType,
  targetId,
  action,
  reason,
  operator,
  oldStatus,
  newStatus,
  metadata
}) {
  const log = new ProcessLog({
    logId: uuidv4(),
    targetType,
    targetId,
    action,
    reason,
    operator,
    operatedAt: new Date(),
    oldStatus,
    newStatus,
    metadata
  });
  await log.save();
  return log;
}

async function getLogTrail(targetType, targetId) {
  return ProcessLog.find({ targetType, targetId })
    .sort({ operatedAt: 1 })
    .lean();
}

module.exports = { writeProcessLog, getLogTrail };
