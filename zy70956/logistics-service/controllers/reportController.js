const { v4: uuidv4 } = require('uuid');
const {
  Report,
  RepairRequest,
  Rating,
  Appeal,
  Worker,
  ProcessLog
} = require('../models');
const { writeProcessLog } = require('../utils/logger');
const { exportRepairsToCSV, exportRatingsToCSV } = require('../utils/exporter');

exports.generateRepairReport = async (req, res) => {
  const { building, startDate, endDate, status } = req.body;
  const operator = req.operator;

  const filter = {};
  if (building) filter.building = building;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.reportedAt = {};
    if (startDate) filter.reportedAt.$gte = new Date(startDate);
    if (endDate) filter.reportedAt.$lte = new Date(endDate);
  }

  const records = await RepairRequest.find(filter).sort({ reportedAt: -1 }).lean();
  const statusBreakdown = {};
  for (const r of records) {
    statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
  }

  const report = new Report({
    reportId: uuidv4(),
    reportType: '维修明细',
    title: `维修明细报告 - ${building || '全部楼栋'}`,
    filters: { building, startDate, endDate, status },
    summary: {
      totalCount: records.length,
      statusBreakdown
    },
    recordRefs: records.map(r => ({ type: 'RepairRequest', id: r.requestId })),
    generatedBy: operator
  });
  await report.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: report.reportId,
    action: '导出',
    reason: `生成维修明细报告，共 ${records.length} 条记录`,
    operator
  });

  res.json({
    success: true,
    data: {
      reportId: report.reportId,
      title: report.title,
      summary: report.summary,
      generatedAt: report.generatedAt,
      recordCount: records.length
    }
  });
};

exports.generateRatingReport = async (req, res) => {
  const { workerId, startDate, endDate, excludeMalicious } = req.body;
  const operator = req.operator;

  const filter = {};
  if (workerId) filter.workerId = workerId;
  if (startDate || endDate) {
    filter.ratedAt = {};
    if (startDate) filter.ratedAt.$gte = new Date(startDate);
    if (endDate) filter.ratedAt.$lte = new Date(endDate);
  }
  if (excludeMalicious) filter.isMalicious = { $ne: true };

  const ratings = await Rating.find(filter).sort({ ratedAt: -1 }).lean();
  const scoreDistribution = {};
  for (const r of ratings) {
    scoreDistribution[r.score] = (scoreDistribution[r.score] || 0) + 1;
  }
  const avgScore = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(2)
    : null;

  const report = new Report({
    reportId: uuidv4(),
    reportType: '评分汇总',
    title: `评分汇总报告 - ${workerId || '全部维修工'}`,
    filters: { workerId, startDate, endDate, excludeMalicious },
    summary: {
      totalCount: ratings.length,
      scoreDistribution,
      avgScore
    },
    recordRefs: ratings.map(r => ({ type: 'Rating', id: r.ratingId })),
    generatedBy: operator
  });
  await report.save();

  res.json({
    success: true,
    data: {
      reportId: report.reportId,
      title: report.title,
      summary: report.summary,
      generatedAt: report.generatedAt
    }
  });
};

exports.generateComprehensiveReport = async (req, res) => {
  const { building, startDate, endDate } = req.body;
  const operator = req.operator;

  const repairFilter = {};
  if (building) repairFilter.building = building;
  if (startDate || endDate) {
    repairFilter.reportedAt = {};
    if (startDate) repairFilter.reportedAt.$gte = new Date(startDate);
    if (endDate) repairFilter.reportedAt.$lte = new Date(endDate);
  }

  const repairs = await RepairRequest.find(repairFilter).lean();
  const repairStatusBreakdown = {};
  for (const r of repairs) {
    repairStatusBreakdown[r.status] = (repairStatusBreakdown[r.status] || 0) + 1;
  }

  const ratingFilter = {};
  if (startDate || endDate) {
    ratingFilter.ratedAt = {};
    if (startDate) ratingFilter.ratedAt.$gte = new Date(startDate);
    if (endDate) ratingFilter.ratedAt.$lte = new Date(endDate);
  }
  const ratings = await Rating.find(ratingFilter).lean();
  const avgScore = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(2)
    : null;

  const appealFilter = {};
  if (startDate || endDate) {
    appealFilter.createdAt = {};
    if (startDate) appealFilter.createdAt.$gte = new Date(startDate);
    if (endDate) appealFilter.createdAt.$lte = new Date(endDate);
  }
  const appeals = await Appeal.find(appealFilter).lean();
  const appealStatusBreakdown = {};
  for (const a of appeals) {
    appealStatusBreakdown[a.appealStatus] = (appealStatusBreakdown[a.appealStatus] || 0) + 1;
  }

  const overtimeRepairs = repairs.filter(r => {
    if (!r.assignedAt || !r.completedAt) return false;
    const diffHours = (r.completedAt - r.assignedAt) / 3600000;
    return diffHours > 48;
  });

  const duplicateRepairs = repairs.filter(r => r.isDuplicate);

  const report = new Report({
    reportId: uuidv4(),
    reportType: '综合报告',
    title: `综合报告 - ${building || '全部楼栋'} - ${startDate || '不限'} 至 ${endDate || '不限'}`,
    filters: { building, startDate, endDate },
    summary: {
      totalRepairs: repairs.length,
      repairStatusBreakdown,
      totalRatings: ratings.length,
      avgScore,
      totalAppeals: appeals.length,
      appealStatusBreakdown,
      overtimeRepairs: overtimeRepairs.length,
      duplicateRepairs: duplicateRepairs.length
    },
    recordRefs: [
      ...repairs.map(r => ({ type: 'RepairRequest', id: r.requestId })),
      ...ratings.map(r => ({ type: 'Rating', id: r.ratingId })),
      ...appeals.map(a => ({ type: 'Appeal', id: a.appealId }))
    ],
    generatedBy: operator
  });
  await report.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: report.reportId,
    action: '导出',
    reason: `生成综合报告`,
    operator
  });

  res.json({
    success: true,
    data: {
      reportId: report.reportId,
      title: report.title,
      summary: report.summary,
      generatedAt: report.generatedAt,
      _links: {
        detail: `/api/report/${report.reportId}`
      }
    }
  });
};

exports.getReport = async (req, res) => {
  const { reportId } = req.params;
  const report = await Report.findOne({ reportId }).lean();
  if (!report) {
    return res.status(404).json({ success: false, error: '报告不存在' });
  }

  const detailRecords = [];
  for (const ref of report.recordRefs) {
    if (ref.type === 'RepairRequest') {
      const r = await RepairRequest.findOne({ requestId: ref.id }).lean();
      if (r) detailRecords.push({ type: 'RepairRequest', data: r });
    } else if (ref.type === 'Rating') {
      const r = await Rating.findOne({ ratingId: ref.id }).lean();
      if (r) detailRecords.push({ type: 'Rating', data: r });
    } else if (ref.type === 'Appeal') {
      const a = await Appeal.findOne({ appealId: ref.id }).lean();
      if (a) detailRecords.push({ type: 'Appeal', data: a });
    }
  }

  res.json({
    success: true,
    data: {
      ...report,
      detailRecords
    }
  });
};

exports.listReports = async (req, res) => {
  const { reportType, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (reportType) filter.reportType = reportType;

  const total = await Report.countDocuments(filter);
  const list = await Report.find(filter)
    .sort({ generatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({
    success: true,
    data: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), list }
  });
};

exports.getFullTraceFromReport = async (req, res) => {
  const { reportId } = req.params;
  const report = await Report.findOne({ reportId }).lean();
  if (!report) {
    return res.status(404).json({ success: false, error: '报告不存在' });
  }

  const traceData = [];
  for (const ref of report.recordRefs) {
    const item = { recordRef: ref, detail: null, logTrail: [] };
    if (ref.type === 'RepairRequest') {
      item.detail = await RepairRequest.findOne({ requestId: ref.id }).lean();
      item.logTrail = await ProcessLog.find({
        targetType: 'RepairRequest',
        targetId: ref.id
      }).sort({ operatedAt: 1 }).lean();
    } else if (ref.type === 'Rating') {
      item.detail = await Rating.findOne({ ratingId: ref.id }).lean();
      item.logTrail = await ProcessLog.find({
        targetType: 'Rating',
        targetId: ref.id
      }).sort({ operatedAt: 1 }).lean();
      if (item.detail && item.detail.hasAppeal) {
        const appeal = await Appeal.findOne({ ratingId: ref.id }).lean();
        if (appeal) {
          item.appeal = appeal;
          item.appealLogTrail = await ProcessLog.find({
            targetType: 'Appeal',
            targetId: appeal.appealId
          }).sort({ operatedAt: 1 }).lean();
        }
      }
    } else if (ref.type === 'Appeal') {
      item.detail = await Appeal.findOne({ appealId: ref.id }).lean();
      item.logTrail = await ProcessLog.find({
        targetType: 'Appeal',
        targetId: ref.id
      }).sort({ operatedAt: 1 }).lean();
    }
    traceData.push(item);
  }

  res.json({
    success: true,
    data: {
      reportId: report.reportId,
      title: report.title,
      summary: report.summary,
      traceData
    }
  });
};

exports.exportReportData = async (req, res) => {
  const { reportId } = req.params;
  const operator = req.operator;

  const report = await Report.findOne({ reportId }).lean();
  if (!report) {
    return res.status(404).json({ success: false, error: '报告不存在' });
  }

  const repairs = [];
  const ratings = [];
  for (const ref of report.recordRefs) {
    if (ref.type === 'RepairRequest') {
      const r = await RepairRequest.findOne({ requestId: ref.id }).lean();
      if (r) repairs.push(r);
    } else if (ref.type === 'Rating') {
      const r = await Rating.findOne({ ratingId: ref.id }).lean();
      if (r) ratings.push(r);
    }
  }

  const result = await exportRepairsToCSV(repairs);

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: reportId,
    action: '导出',
    reason: `导出报告数据，共 ${repairs.length} 条`,
    operator,
    metadata: { fileName: result.fileName, recordCount: result.recordCount }
  });

  res.download(result.filePath, result.fileName);
};
