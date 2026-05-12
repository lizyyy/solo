const { Rectification, Inspection, Review, Stall, sequelize } = require('../models');
const Joi = require('joi');
const moment = require('moment');
const discountService = require('../services/discountService');

function generateNo(prefix) {
  return `${prefix}${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
}

const rectificationSchema = Joi.object({
  inspectionId: Joi.number().required(),
  stallId: Joi.number().required(),
  requirement: Joi.string().required(),
  deadline: Joi.date().required()
});

const submitRectificationSchema = Joi.object({
  description: Joi.string().required()
});

const reviewSchema = Joi.object({
  reviewer: Joi.string().required(),
  result: Joi.string().valid('pass', 'fail').required(),
  remark: Joi.string().optional(),
  pointsReturned: Joi.number().min(0).max(100).default(0)
});

exports.createRectification = async (req, res) => {
  try {
    const { error, value } = rectificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const inspection = await Inspection.findByPk(value.inspectionId);
    if (!inspection) {
      return res.status(404).json({ error: '检查记录不存在' });
    }

    const stall = await Stall.findByPk(value.stallId);
    if (!stall) {
      return res.status(404).json({ error: '摊位不存在' });
    }

    const existingRectification = await Rectification.findOne({
      where: { inspectionId: value.inspectionId }
    });

    if (existingRectification) {
      return res.status(400).json({ error: '该检查记录已存在整改通知' });
    }

    const rectification = await Rectification.create({
      ...value,
      rectificationNo: generateNo('RECT'),
      status: 'pending'
    });

    await inspection.update({ status: 'rectified' });

    res.status(201).json(rectification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRectifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, stallId, status } = req.query;
    const where = {};

    if (stallId) where.stallId = stallId;
    if (status) where.status = status;

    const { count, rows } = await Rectification.findAndCountAll({
      where,
      include: [{ model: Stall }, { model: Inspection }],
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['id', 'DESC']]
    });

    res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.submitRectification = async (req, res) => {
  try {
    const { error, value } = submitRectificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const rectification = await Rectification.findByPk(req.params.id);
    if (!rectification) {
      return res.status(404).json({ error: '整改记录不存在' });
    }

    if (rectification.status !== 'pending') {
      return res.status(400).json({ error: '该整改已提交，无法重复提交' });
    }

    await rectification.update({
      submitDescription: value.description,
      submittedAt: new Date(),
      status: 'submitted'
    });

    res.json(rectification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createReview = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const rectification = await Rectification.findByPk(req.params.id);
    if (!rectification) {
      await transaction.rollback();
      return res.status(404).json({ error: '整改记录不存在' });
    }

    if (rectification.status !== 'submitted') {
      await transaction.rollback();
      return res.status(400).json({ error: '该整改尚未提交，无法进行复核' });
    }

    const existingReview = await Review.findOne({
      where: { rectificationId: rectification.id }
    });

    if (existingReview) {
      await transaction.rollback();
      return res.status(400).json({ error: '该整改已复核，请勿重复复核' });
    }

    const inspection = await Inspection.findByPk(rectification.inspectionId);

    if (inspection.isLocked) {
      await transaction.rollback();
      return res.status(400).json({ error: `该检查记录所属月份 ${inspection.month} 已锁定，无法进行复核` });
    }

    const { MonthlyDiscount } = require('../models');
    const monthlyDiscount = await MonthlyDiscount.findOne({
      where: { stallId: rectification.stallId, month: inspection.month }
    });

    if (monthlyDiscount && monthlyDiscount.isLocked) {
      await transaction.rollback();
      return res.status(400).json({ error: `该摊位 ${inspection.month} 的优惠数据已锁定，无法进行复核` });
    }

    const review = await Review.create({
      ...value,
      reviewNo: generateNo('REV'),
      rectificationId: rectification.id,
      inspectionId: rectification.inspectionId,
      stallId: rectification.stallId,
      reviewedAt: new Date()
    }, { transaction });

    await rectification.update({ status: 'reviewed' }, { transaction });

    await inspection.update({ status: 'reviewed' }, { transaction });

    if (value.result === 'pass' && value.pointsReturned > 0) {
      await discountService.handleReviewPass(review);
    }

    await transaction.commit();

    res.status(201).json({ review, rectification });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, stallId, result } = req.query;
    const where = {};

    if (stallId) where.stallId = stallId;
    if (result) where.result = result;

    const { count, rows } = await Review.findAndCountAll({
      where,
      include: [{ model: Stall }, { model: Rectification }, { model: Inspection }],
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['id', 'DESC']]
    });

    res.json({
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
