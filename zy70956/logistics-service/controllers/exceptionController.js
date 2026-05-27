const { RepairRequest, Rating, ProcessLog } = require('../models');
const { writeProcessLog } = require('../utils/logger');
const config = require('../config');

exports.markDuplicate = async (req, res) => {
  const { requestId, duplicateOf, duplicateReason } = req.body;
  const operator = req.operator;

  if (!requestId || !duplicateOf || !duplicateReason) {
    return res.status(400).json({
      success: false,
      error: 'requestId, duplicateOf, duplicateReason 均为必填'
    });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  const original = await RepairRequest.findOne({ requestId: duplicateOf });
  if (!original) {
    return res.status(404).json({ success: false, error: '被指向的原始记录不存在' });
  }

  record.isDuplicate = true;
  record.duplicateOf = duplicateOf;
  record.duplicateReason = duplicateReason;
  record.status = '已关闭';
  record.closedReason = `重复报修，参照 ${duplicateOf}`;
  record.closedAt = new Date();
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '标记重复',
    reason: duplicateReason,
    operator,
    oldStatus: record.status,
    newStatus: '已关闭',
    metadata: { duplicateOf }
  });

  res.json({
    success: true,
    data: {
      requestId,
      isDuplicate: true,
      duplicateOf,
      duplicateReason,
      status: '已关闭'
    }
  });
};

exports.unmarkDuplicate = async (req, res) => {
  const { requestId, reason } = req.body;
  const operator = req.operator;

  if (!requestId || !reason) {
    return res.status(400).json({ success: false, error: 'requestId 和 reason 均为必填' });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  record.isDuplicate = false;
  record.duplicateOf = undefined;
  record.duplicateReason = undefined;
  record.status = '待处理';
  record.closedReason = undefined;
  record.closedAt = undefined;
  await record.save();

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '取消重复标记',
    reason,
    operator
  });

  res.json({
    success: true,
    data: { requestId, isDuplicate: false, status: '待处理' }
  });
};

exports.scanDuplicates = async (req, res) => {
  const { building, startDate, endDate } = req.body;

  const filter = {};
  if (building) filter.building = building;
  if (startDate || endDate) {
    filter.reportedAt = {};
    if (startDate) filter.reportedAt.$gte = new Date(startDate);
    if (endDate) filter.reportedAt.$lte = new Date(endDate);
  }

  const records = await RepairRequest.find(filter).sort({ reportedAt: 1 }).lean();
  const potentialDuplicates = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      if (a.building === b.building && a.room === b.room && a.repairType === b.repairType) {
        const descriptionSimilarity = calcSimilarity(a.description, b.description);
        const timeDiff = Math.abs(a.reportedAt - b.reportedAt);
        if (descriptionSimilarity > 0.7 && timeDiff < 86400000) {
          potentialDuplicates.push({
            recordA: { requestId: a.requestId, reportedAt: a.reportedAt, description: a.description },
            recordB: { requestId: b.requestId, reportedAt: b.reportedAt, description: b.description },
            similarity: descriptionSimilarity,
            timeDiffHours: (timeDiff / 3600000).toFixed(2)
          });
        }
      }
    }
  }

  res.json({
    success: true,
    data: {
      scannedCount: records.length,
      potentialDuplicatePairs: potentialDuplicates.length,
      pairs: potentialDuplicates
    }
  });
};

exports.penalizeOvertime = async (req, res) => {
  const { requestId, penaltyReason } = req.body;
  const operator = req.operator;

  if (!requestId || !penaltyReason) {
    return res.status(400).json({
      success: false,
      error: 'requestId 和 penaltyReason 均为必填'
    });
  }

  const record = await RepairRequest.findOne({ requestId });
  if (!record) {
    return res.status(404).json({ success: false, error: '报修记录不存在' });
  }

  if (!record.assignedAt || !record.completedAt) {
    return res.status(400).json({
      success: false,
      error: '该记录尚未派单或完成，无法判定超时'
    });
  }

  const diffHours = (record.completedAt - record.assignedAt) / 3600000;
  if (diffHours <= config.OVERTIME_THRESHOLD_HOURS) {
    return res.status(400).json({
      success: false,
      error: `处理时长 ${diffHours.toFixed(1)} 小时，未超过阈值 ${config.OVERTIME_THRESHOLD_HOURS} 小时`
    });
  }

  const penaltyScore = Math.min(5, Math.floor((diffHours - config.OVERTIME_THRESHOLD_HOURS) / 24) + 1);

  await writeProcessLog({
    targetType: 'RepairRequest',
    targetId: requestId,
    action: '超时罚分',
    reason: penaltyReason,
    operator,
    metadata: {
      overtimeHours: diffHours,
      thresholdHours: config.OVERTIME_THRESHOLD_HOURS,
      penaltyScore
    }
  });

  res.json({
    success: true,
    data: {
      requestId,
      overtimeHours: diffHours,
      thresholdHours: config.OVERTIME_THRESHOLD_HOURS,
      penaltyScore,
      penaltyReason
    }
  });
};

exports.scanOvertime = async (req, res) => {
  const records = await RepairRequest.find({
    status: '已完成',
    assignedAt: { $exists: true },
    completedAt: { $exists: true }
  }).lean();

  const overtimeRecords = [];
  for (const r of records) {
    const diffHours = (r.completedAt - r.assignedAt) / 3600000;
    if (diffHours > config.OVERTIME_THRESHOLD_HOURS) {
      overtimeRecords.push({
        requestId: r.requestId,
        workerId: r.assignedWorkerId,
        assignedAt: r.assignedAt,
        completedAt: r.completedAt,
        overtimeHours: (diffHours - config.OVERTIME_THRESHOLD_HOURS).toFixed(1)
      });
    }
  }

  res.json({
    success: true,
    data: {
      totalCompleted: records.length,
      overtimeCount: overtimeRecords.length,
      overtimeRecords
    }
  });
};

exports.getExceptionSummary = async (req, res) => {
  const duplicateCount = await RepairRequest.countDocuments({ isDuplicate: true });
  const maliciousCount = await Rating.countDocuments({ isMalicious: true });
  const pendingAppeals = await RepairRequest.countDocuments({ appealStatus: '待审核' });

  const overtimeRecords = await RepairRequest.find({
    status: '已完成',
    assignedAt: { $exists: true },
    completedAt: { $exists: true }
  }).lean();

  let overtimeCount = 0;
  for (const r of overtimeRecords) {
    const diffHours = (r.completedAt - r.assignedAt) / 3600000;
    if (diffHours > config.OVERTIME_THRESHOLD_HOURS) overtimeCount++;
  }

  res.json({
    success: true,
    data: {
      duplicateRepairs: duplicateCount,
      maliciousRatings: maliciousCount,
      pendingAppeals,
      overtimeRepairs: overtimeCount,
      totalExceptions: duplicateCount + maliciousCount + pendingAppeals + overtimeCount
    }
  });
};

function calcSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const maxLen = Math.max(len1, len2);
  let matches = 0;
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (s1[i] === s2[i]) matches++;
  }
  return matches / maxLen;
}
