const { RepairRequest, Rating, Appeal, Worker, ProcessLog } = require('../models');
const { writeProcessLog } = require('../utils/logger');
const { exportRepairsToCSV, exportRatingsToCSV, exportAppealsToCSV, getExportFilePath } = require('../utils/exporter');

exports.queryByBuilding = async (req, res) => {
  const { building } = req.params;
  const { startDate, endDate, status, page = 1, limit = 20 } = req.query;
  const filter = { building };
  if (status) filter.status = status;
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

  const statusBreakdown = {};
  for (const r of list) {
    statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
  }

  res.json({
    success: true,
    data: {
      building,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      statusBreakdown,
      list
    }
  });
};

exports.queryByWorker = async (req, res) => {
  const { workerId } = req.params;
  const { startDate, endDate, status, page = 1, limit = 20 } = req.query;
  const filter = { assignedWorkerId: workerId };
  if (status) filter.status = status;
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

  const ratings = await Rating.find({ workerId, isMalicious: { $ne: true } }).lean();
  const avgScore = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(2)
    : null;

  res.json({
    success: true,
    data: {
      workerId,
      totalTasks: total,
      avgScore,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      list
    }
  });
};

exports.queryByAppeal = async (req, res) => {
  const { appealStatus } = req.params;
  const validStatuses = ['待审核', '通过', '驳回'];
  if (!validStatuses.includes(appealStatus)) {
    return res.status(400).json({
      success: false,
      error: `appealStatus 必须是 ${validStatuses.join('/')} 之一`
    });
  }

  const { page = 1, limit = 20 } = req.query;
  const filter = { appealStatus };

  const total = await Appeal.countDocuments(filter);
  const list = await Appeal.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({
    success: true,
    data: {
      appealStatus,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      list
    }
  });
};

exports.getBuildings = async (req, res) => {
  const buildings = await RepairRequest.distinct('building');
  res.json({ success: true, data: { buildings: buildings.sort() } });
};

exports.exportByBuilding = async (req, res) => {
  const { building } = req.params;
  const { startDate, endDate, status } = req.query;
  const operator = req.operator;

  const filter = { building };
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.reportedAt = {};
    if (startDate) filter.reportedAt.$gte = new Date(startDate);
    if (endDate) filter.reportedAt.$lte = new Date(endDate);
  }

  const records = await RepairRequest.find(filter).sort({ reportedAt: -1 }).lean();
  const result = await exportRepairsToCSV(records);

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: building,
    action: '导出',
    reason: `导出楼栋 ${building} 的维修记录，共 ${result.recordCount} 条`,
    operator,
    metadata: { fileName: result.fileName, recordCount: result.recordCount }
  });

  res.download(result.filePath, result.fileName, err => {
    if (err) console.error('[Export] 文件下载失败:', err);
  });
};

exports.exportByWorker = async (req, res) => {
  const { workerId } = req.params;
  const { startDate, endDate } = req.query;
  const operator = req.operator;

  const filter = { assignedWorkerId: workerId };
  if (startDate || endDate) {
    filter.reportedAt = {};
    if (startDate) filter.reportedAt.$gte = new Date(startDate);
    if (endDate) filter.reportedAt.$lte = new Date(endDate);
  }

  const records = await RepairRequest.find(filter).sort({ reportedAt: -1 }).lean();
  const result = await exportRepairsToCSV(records);

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: workerId,
    action: '导出',
    reason: `导出维修工 ${workerId} 的维修记录，共 ${result.recordCount} 条`,
    operator,
    metadata: { fileName: result.fileName, recordCount: result.recordCount }
  });

  res.download(result.filePath, result.fileName);
};

exports.exportAppeals = async (req, res) => {
  const { appealStatus } = req.params;
  const operator = req.operator;

  const filter = {};
  if (appealStatus && appealStatus !== 'all') {
    filter.appealStatus = appealStatus;
  }

  const records = await Appeal.find(filter).sort({ createdAt: -1 }).lean();
  const result = await exportAppealsToCSV(records);

  await writeProcessLog({
    targetType: 'Appeal',
    targetId: appealStatus || 'all',
    action: '导出',
    reason: `导出申诉记录，共 ${result.recordCount} 条`,
    operator,
    metadata: { fileName: result.fileName, recordCount: result.recordCount }
  });

  res.download(result.filePath, result.fileName);
};

exports.traceRecord = async (req, res) => {
  const { recordType, recordId } = req.params;
  const validTypes = ['RepairRequest', 'Rating', 'Appeal', 'Batch'];
  if (!validTypes.includes(recordType)) {
    return res.status(400).json({
      success: false,
      error: `recordType 必须是 ${validTypes.join('/')} 之一`
    });
  }

  const logs = await ProcessLog.find({
    targetType: recordType,
    targetId: recordId
  }).sort({ operatedAt: 1 }).lean();

  let recordData = null;
  if (recordType === 'RepairRequest') {
    recordData = await RepairRequest.findOne({ requestId: recordId }).lean();
  } else if (recordType === 'Rating') {
    recordData = await Rating.findOne({ ratingId: recordId }).lean();
  } else if (recordType === 'Appeal') {
    recordData = await Appeal.findOne({ appealId: recordId }).lean();
  }

  res.json({
    success: true,
    data: {
      recordType,
      recordId,
      record: recordData,
      trail: {
        totalSteps: logs.length,
        steps: logs.map(log => ({
          action: log.action,
          reason: log.reason,
          operator: log.operator,
          operatedAt: log.operatedAt,
          oldStatus: log.oldStatus,
          newStatus: log.newStatus
        }))
      }
    }
  });
};
