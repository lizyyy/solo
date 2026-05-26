const { v4: uuidv4 } = require('uuid');
const { RepairRequest, Worker, Rating } = require('../models');
const { writeProcessLog } = require('../utils/logger');

exports.assignWorker = async (req, res) => {
  const { requestId, workerId, reason } = req.body;
  const operator = req.operator;

  if (!requestId || !workerId) {
    return res.status(400).json({ success: false, error: 'requestId 和 workerId 均为必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (record.status === '已完成' || record.status === '已关闭') {
    return res.status(400).json({ success: false, error: `当前状态 ${record.status}，无法派单` });
  }

  const worker = await Worker.findOne({ workerId });
  if (!worker) {
    return res.status(400).json({ success: false, error: '维修工不存在' });
  }

  const oldStatus = record.status;
  record.assignedWorkerId = workerId;
  record.assignedAt = new Date();
  record.status = '已派单';
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '派单',
    reason: reason || `指派维修工 ${worker.name}(${workerId})`,
    operator,
    oldStatus,
    newStatus: '已派单'
  });

  res.json({
    success: true,
    data: {
      requestId,
      status: '已派单',
      worker: { workerId, name: worker.name, trade: worker.trade }
    }
  });
};

exports.markProcessing = async (req, res) => {
  const { requestId, reason } = req.body;
  const operator = req.operator;

  if (!requestId) {
    return res.status(400).json({ success: false, error: 'requestId 必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (record.status !== '已派单') {
    return res.status(400).json({
      success: false,
      error: `只有已派单状态才能标记处理中，当前状态: ${record.status}`
    });
  }

  const oldStatus = record.status;
  record.status = '处理中';
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '处理中',
    reason: reason || '维修工开始处理',
    operator,
    oldStatus,
    newStatus: '处理中'
  });

  res.json({ success: true, data: { requestId, status: '处理中' } });
};

exports.completeRepair = async (req, res) => {
  const { requestId, reason } = req.body;
  const operator = req.operator;

  if (!requestId) {
    return res.status(400).json({ success: false, error: 'requestId 必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (record.status !== '处理中') {
    return res.status(400).json({
      success: false,
      error: `只有处理中状态才能标记完成，当前状态: ${record.status}`
    });
  }

  const oldStatus = record.status;
  record.status = '已完成';
  record.completedAt = new Date();
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '完成',
    reason: reason || '维修完成',
    operator,
    oldStatus,
    newStatus: '已完成'
  });

  res.json({ success: true, data: { requestId, status: '已完成', completedAt: record.completedAt } });
};

exports.returnForRevision = async (req, res) => {
  const { requestId, reason } = req.body;
  const operator = req.operator;

  if (!requestId || !reason) {
    return res.status(400).json({ success: false, error: 'requestId 和 reason 均为必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (record.status === '已完成' || record.status === '已关闭') {
    return res.status(400).json({
      success: false,
      error: `当前状态 ${record.status}，无法退回`
    });
  }

  const oldStatus = record.status;
  record.status = '已退回';
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '退回',
    reason,
    operator,
    oldStatus,
    newStatus: '已退回'
  });

  res.json({
    success: true,
    data: { requestId, status: '已退回', returnReason: reason }
  });
};

exports.closeRepair = async (req, res) => {
  const { requestId, closedReason } = req.body;
  const operator = req.operator;

  if (!requestId || !closedReason) {
    return res.status(400).json({ success: false, error: 'requestId 和 closedReason 均为必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (record.status === '已完成' || record.status === '已关闭') {
    return res.status(400).json({
      success: false,
      error: `当前状态 ${record.status}，无法关闭`
    });
  }

  const oldStatus = record.status;
  record.status = '已关闭';
  record.closedReason = closedReason;
  record.closedAt = new Date();
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '关闭',
    reason: closedReason,
    operator,
    oldStatus,
    newStatus: '已关闭'
  });

  res.json({
    success: true,
    data: { requestId, status: '已关闭', closedReason }
  });
};

exports.getRepairDetail = async (req, res) => {
  const { requestId } = req.params;
  const record = await RepairRequest.findOne({ requestId })
    .populate('assignedWorkerId', 'workerId name trade phone')
    .lean();

  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  const ratings = await Rating.find({ requestId }).sort({ ratedAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      ...record,
      ratings,
      _links: {
        self: `/api/repair/${requestId}`,
        logTrail: `/api/repair/${requestId}/logs`,
        ratings: `/api/rating/by-request/${requestId}`
      }
    }
  });
};

exports.getRepairLogs = async (req, res) => {
  const { requestId } = req.params;
  const { getLogTrail } = require('../utils/logger');
  const logs = await getLogTrail('RepairRequest', requestId);
  res.json({ success: true, data: { requestId, logCount: logs.length, logs } });
};

exports.listRepairs = async (req, res) => {
  const { status, building, workerId, startDate, endDate, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (building) filter.building = building;
  if (workerId) filter.assignedWorkerId = workerId;
  if (startDate || endDate) {
    filter.reportedAt = {};
    if (startDate) filter.reportedAt.$gte = new Date(startDate);
    if (endDate) filter.reportedAt.$lte = new Date(endDate);
  }

  const total = await RepairRequest.countDocuments(filter);
  const list = await RepairRequest.find(filter)
    .sort({ reportedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({
    success: true,
    data: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), list }
  });
};
