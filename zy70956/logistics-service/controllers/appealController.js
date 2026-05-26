const { v4: uuidv4 } = require('uuid');
const { Appeal, Rating, Worker } = require('../models');
const { writeProcessLog } = require('../utils/logger');

exports.submitAppeal = async (req, res) => {
  const { ratingId, appellant, appellantRole, appealReason } = req.body;
  const operator = req.operator;

  if (!ratingId || !appellant || !appellantRole || !appealReason) {
    return res.status(400).json({
      success: false,
      error: 'ratingId, appellant, appellantRole, appealReason 均为必填'
    });
  }

  const rating = await Rating.findOne({ ratingId });
  if (!rating) {
    return res.status(404).json({ success: false, error: '评分记录不存在' });
  }

  const existing = await Appeal.findOne({ ratingId, appealStatus: '待审核' });
  if (existing) {
    return res.status(400).json({
      success: false,
      error: '该评分已有待审核的申诉，请等待处理结果'
    });
  }

  const appealId = uuidv4();
  const appeal = new Appeal({
    appealId,
    ratingId,
    requestId: rating.requestId,
    workerId: rating.workerId,
    appellant,
    appellantRole,
    appealReason,
    appealStatus: '待审核'
  });
  await appeal.save();

  rating.hasAppeal = true;
  rating.appealStatus = '待审核';
  await rating.save();

  await writeProcessLog({
    targetType: 'Appeal',
    targetId: appealId,
    action: '申诉提交',
    reason: appealReason,
    operator
  });

  await writeProcessLog({
    targetType: 'Rating',
    targetId: ratingId,
    action: '修改',
    reason: `关联申诉 ${appealId}`,
    operator
  });

  res.json({
    success: true,
    data: { appealId, ratingId, appealStatus: '待审核', message: '申诉已提交，等待审核' }
  });
};

exports.reviewAppeal = async (req, res) => {
  const { appealId, decision, reviewReason } = req.body;
  const operator = req.operator;

  if (!appealId || !decision || !reviewReason) {
    return res.status(400).json({
      success: false,
      error: 'appealId, decision, reviewReason 均为必填'
    });
  }

  const validDecisions = ['通过', '驳回'];
  if (!validDecisions.includes(decision)) {
    return res.status(400).json({
      success: false,
      error: `decision 必须是 ${validDecisions.join('/')} 之一`
    });
  }

  const appeal = await Appeal.findOne({ appealId });
  if (!appeal) {
    return res.status(404).json({ success: false, error: '申诉不存在' });
  }

  if (appeal.appealStatus !== '待审核') {
    return res.status(400).json({
      success: false,
      error: `该申诉已处理，当前状态: ${appeal.appealStatus}`
    });
  }

  appeal.appealStatus = decision;
  appeal.reviewReason = reviewReason;
  appeal.reviewedBy = operator;
  appeal.reviewedAt = new Date();
  await appeal.save();

  const rating = await Rating.findOne({ ratingId: appeal.ratingId });
  if (rating) {
    if (decision === '通过') {
      rating.isMalicious = true;
      rating.maliciousReason = `申诉通过: ${reviewReason}`;
      rating.maliciousHandledBy = operator;
      rating.maliciousHandledAt = new Date();
      rating.appealStatus = '通过';
    } else {
      rating.appealStatus = '驳回';
    }
    await rating.save();
  }

  await writeProcessLog({
    targetType: 'Appeal',
    targetId: appealId,
    action: decision === '通过' ? '申诉通过' : '申诉驳回',
    reason: reviewReason,
    operator,
    oldStatus: '待审核',
    newStatus: decision
  });

  res.json({
    success: true,
    data: {
      appealId,
      appealStatus: decision,
      reviewReason,
      reviewedBy: operator,
      reviewedAt: appeal.reviewedAt
    }
  });
};

exports.listAppeals = async (req, res) => {
  const { appealStatus, workerId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (appealStatus) filter.appealStatus = appealStatus;
  if (workerId) filter.workerId = workerId;

  const total = await Appeal.countDocuments(filter);
  const list = await Appeal.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10))
    .lean();

  res.json({
    success: true,
    data: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), list }
  });
};

exports.getAppealDetail = async (req, res) => {
  const { appealId } = req.params;
  const appeal = await Appeal.findOne({ appealId }).lean();
  if (!appeal) {
    return res.status(404).json({ success: false, error: '申诉不存在' });
  }

  const rating = await Rating.findOne({ ratingId: appeal.ratingId }).lean();
  const worker = await Worker.findOne({ workerId: appeal.workerId }).lean();

  res.json({
    success: true,
    data: {
      ...appeal,
      rating: rating ? { score: rating.score, comment: rating.comment, ratedAt: rating.ratedAt } : null,
      worker: worker ? { name: worker.name, trade: worker.trade } : null
    }
  });
};
