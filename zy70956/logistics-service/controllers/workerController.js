const { Worker, RepairRequest } = require('../models');
const { writeProcessLog } = require('../utils/logger');

exports.listWorkers = async (req, res) => {
  const { trade, status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (trade) filter.trade = trade;
  if (status) filter.status = status;

  const total = await Worker.countDocuments(filter);
  const list = await Worker.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({
    success: true,
    data: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), list }
  });
};

exports.getWorker = async (req, res) => {
  const { workerId } = req.params;
  const worker = await Worker.findOne({ workerId }).lean();
  if (!worker) {
    return res.status(404).json({ success: false, error: '维修工不存在' });
  }

  const activeTasks = await RepairRequest.countDocuments({
    assignedWorkerId: workerId,
    status: { $in: ['已派单', '处理中'] }
  });
  const completedTasks = await RepairRequest.countDocuments({
    assignedWorkerId: workerId,
    status: '已完成'
  });

  res.json({
    success: true,
    data: {
      ...worker,
      stats: { activeTasks, completedTasks }
    }
  });
};

exports.updateWorker = async (req, res) => {
  const { workerId, ...updateData } = req.body;
  const operator = req.operator;

  if (!workerId) {
    return res.status(400).json({ success: false, error: 'workerId 必填' });
  }

  const worker = await Worker.findOne({ workerId });
  if (!worker) {
    return res.status(404).json({ success: false, error: '维修工不存在' });
  }

  Object.assign(worker, updateData);
  await worker.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: workerId,
    action: '修改',
    reason: `更新维修工信息: ${JSON.stringify(updateData)}`,
    operator
  });

  res.json({ success: true, data: worker });
};
