const { v4: uuidv4 } = require('uuid');
const { Rating, RepairRequest, Worker } = require('../models');
const { writeProcessLog } = require('../utils/logger');
const config = require('../config');

exports.createRating = async (req, res) => {
  const data = req.body;
  const operator = req.operator;

  if (!data.ratingId || !data.requestId || !data.workerId || !data.score) {
    return res.status(400).json({
      success: false,
      error: 'ratingId, requestId, workerId, score 均为必填'
    });
  }

  if (data.score < 1 || data.score > 5) {
    return res.status(400).json({ success: false, error: '评分必须是 1-5 的整数' });
  }

  const exists = await Rating.findOne({ ratingId: data.ratingId });
  if (exists) {
    return res.status(400).json({ success: false, error: '评分单号已存在' });
  }

  const request = await RepairRequest.findOne({ requestId: data.requestId });
  if (!request) {
    return res.status(400).json({ success: false, error: '关联的报修记录不存在' });
  }

  const rating = new Rating({
    ...data,
    ratedAt: data.ratedAt || new Date()
  });
  await rating.save();

  await writeProcessLog({
    targetType: 'Rating',
    targetId: data.ratingId,
    action: '新增',
    reason: `新增评分记录: ${data.score}分`,
    operator
  });

  res.json({
    success: true,
    data: { ratingId: data.ratingId, score: data.score, message: '评分记录已创建' }
  });
};

exports.markMalicious = async (req, res) => {
  const { ratingId, maliciousReason } = req.body;
  const operator = req.operator;

  if (!ratingId || !maliciousReason) {
    return res.status(400).json({ success: false, error: 'ratingId 和 maliciousReason 均为必填' });
  }

  const rating = await Rating.findOne({ ratingId });
  if (!rating) {
    return res.status(404).json({ success: false, error: '评分记录不存在' });
  }

  rating.isMalicious = true;
  rating.maliciousReason = maliciousReason;
  rating.maliciousHandledBy = operator;
  rating.maliciousHandledAt = new Date();
  await rating.save();

  await writeProcessLog({
    targetType: 'Rating',
    targetId: ratingId,
    action: '标记恶意评分',
    reason: maliciousReason,
    operator
  });

  res.json({
    success: true,
    data: {
      ratingId,
      isMalicious: true,
      maliciousReason,
      maliciousHandledBy: operator,
      maliciousHandledAt: rating.maliciousHandledAt
    }
  });
};

exports.unmarkMalicious = async (req, res) => {
  const { ratingId, reason } = req.body;
  const operator = req.operator;

  if (!ratingId || !reason) {
    return res.status(400).json({ success: false, error: 'ratingId 和 reason 均为必填' });
  }

  const rating = await Rating.findOne({ ratingId });
  if (!rating) {
    return res.status(404).json({ success: false, error: '评分记录不存在' });
  }

  rating.isMalicious = false;
  rating.maliciousReason = undefined;
  rating.maliciousHandledBy = undefined;
  rating.maliciousHandledAt = undefined;
  await rating.save();

  await writeProcessLog({
    targetType: 'Rating',
    targetId: ratingId,
    action: '修改',
    reason: `取消恶意评分标记: ${reason}`,
    operator
  });

  res.json({ success: true, data: { ratingId, isMalicious: false } });
};

exports.getRatingDetail = async (req, res) => {
  const { ratingId } = req.params;
  const rating = await Rating.findOne({ ratingId }).lean();
  if (!rating) {
    return res.status(404).json({ success: false, error: '评分记录不存在' });
  }

  const request = await RepairRequest.findOne({ requestId: rating.requestId }).lean();
  const worker = await Worker.findOne({ workerId: rating.workerId }).lean();

  res.json({
    success: true,
    data: {
      ...rating,
      repairRequest: request,
      worker: worker ? { workerId: worker.workerId, name: worker.name, trade: worker.trade } : null
    }
  });
};

exports.getRatingsByRequest = async (req, res) => {
  const { requestId } = req.params;
  const ratings = await Rating.find({ requestId }).sort({ ratedAt: -1 }).lean();
  res.json({ success: true, data: { requestId, count: ratings.length, ratings } });
};

exports.getRatingsByWorker = async (req, res) => {
  const { workerId } = req.params;
  const { startDate, endDate, excludeMalicious } = req.query;
  const filter = { workerId };
  if (startDate || endDate) {
    filter.ratedAt = {};
    if (startDate) filter.ratedAt.$gte = new Date(startDate);
    if (endDate) filter.ratedAt.$lte = new Date(endDate);
  }
  if (excludeMalicious === 'true') {
    filter.isMalicious = { $ne: true };
  }

  const ratings = await Rating.find(filter).sort({ ratedAt: -1 }).lean();
  const avgScore = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(2)
    : null;

  res.json({
    success: true,
    data: { workerId, count: ratings.length, avgScore, ratings }
  });
};

exports.checkMaliciousPattern = async (req, res) => {
  const { ratedBy, startTime, endTime } = req.body;

  if (!ratedBy) {
    return res.status(400).json({ success: false, error: 'ratedBy 必填' });
  }

  const start = startTime ? new Date(startTime) : new Date(Date.now() - 3600000);
  const end = endTime ? new Date(endTime) : new Date();

  const ratings = await Rating.find({
    ratedBy,
    ratedAt: { $gte: start, $lte: end }
  }).sort({ ratedAt: 1 }).lean();

  const patterns = [];
  if (ratings.length > config.MALICIOUS_RATING.MAX_RATINGS_PER_HOUR) {
    patterns.push({
      type: 'FREQUENCY',
      description: `${ratedBy} 在 1 小时内评分 ${ratings.length} 次，超过阈值 ${config.MALICIOUS_RATING.MAX_RATINGS_PER_HOUR}`,
      count: ratings.length,
      threshold: config.MALICIOUS_RATING.MAX_RATINGS_PER_HOUR
    });
  }

  for (let i = 1; i < ratings.length; i++) {
    const diff = ratings[i].ratedAt - ratings[i - 1].ratedAt;
    if (diff < config.MALICIOUS_RATING.MIN_INTERVAL_MS) {
      patterns.push({
        type: 'INTERVAL',
        description: `评分间隔 ${diff}ms，低于最小间隔 ${config.MALICIOUS_RATING.MIN_INTERVAL_MS}ms`,
        ratingIds: [ratings[i - 1].ratingId, ratings[i].ratingId],
        interval: diff
      });
    }
  }

  const lowScores = ratings.filter(r => r.score <= 2);
  if (lowScores.length >= 3) {
    patterns.push({
      type: 'LOW_SCORE_CLUSTER',
      description: `连续 ${lowScores.length} 条 1-2 分低分记录`,
      ratingIds: lowScores.map(r => r.ratingId)
    });
  }

  res.json({
    success: true,
    data: {
      ratedBy,
      totalInPeriod: ratings.length,
      patterns,
      isSuspicious: patterns.length > 0
    }
  });
};
