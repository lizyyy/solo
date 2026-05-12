const { Inspection, Stall, Deduction, Op, sequelize } = require('../models');
const Joi = require('joi');
const moment = require('moment');
const discountService = require('../services/discountService');

function generateNo(prefix) {
  return `${prefix}${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
}

const inspectionSchema = Joi.object({
  stallId: Joi.number().required(),
  inspector: Joi.string().required(),
  inspectionDate: Joi.date().required(),
  remark: Joi.string().optional()
});

const deductionSchema = Joi.object({
  reason: Joi.string().required(),
  points: Joi.number().min(1).max(100).required(),
  category: Joi.string().optional()
});

exports.createInspection = async (req, res) => {
  try {
    const { error, value } = inspectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const stall = await Stall.findByPk(value.stallId);
    if (!stall) {
      return res.status(404).json({ error: '摊位不存在' });
    }

    const month = moment(value.inspectionDate).format('YYYY-MM');

    const inspection = await Inspection.create({
      ...value,
      inspectionNo: generateNo('INSP'),
      month,
      status: 'pending'
    });

    res.status(201).json(inspection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getInspections = async (req, res) => {
  try {
    const { page = 1, limit = 10, stallId, month, status } = req.query;
    const where = {};

    if (stallId) where.stallId = stallId;
    if (month) where.month = month;
    if (status) where.status = status;

    const { count, rows } = await Inspection.findAndCountAll({
      where,
      include: [{ model: Stall }],
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

exports.getInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findByPk(req.params.id, {
      include: [{ model: Stall }]
    });
    if (!inspection) {
      return res.status(404).json({ error: '检查记录不存在' });
    }
    res.json(inspection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createDeduction = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { error, value } = deductionSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const inspection = await Inspection.findByPk(req.params.id);
    if (!inspection) {
      await transaction.rollback();
      return res.status(404).json({ error: '检查记录不存在' });
    }

    if (inspection.isLocked) {
      await transaction.rollback();
      return res.status(400).json({ error: '该检查记录已锁定，无法修改' });
    }

    const existingDeduction = await Deduction.findOne({
      where: { inspectionId: inspection.id }
    });

    if (existingDeduction) {
      await transaction.rollback();
      return res.status(400).json({ error: '该检查记录已存在扣分，请勿重复扣分' });
    }

    const deduction = await Deduction.create({
      ...value,
      deductionNo: generateNo('DED'),
      inspectionId: inspection.id,
      stallId: inspection.stallId,
      month: inspection.month
    }, { transaction });

    await inspection.update({ status: 'deducted' }, { transaction });

    await discountService.handleDeductionCreated(deduction);

    await transaction.commit();

    res.status(201).json({ deduction, inspection });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
};

exports.getDeductions = async (req, res) => {
  try {
    const { page = 1, limit = 10, stallId, month, isReversed } = req.query;
    const where = {};

    if (stallId) where.stallId = stallId;
    if (month) where.month = month;
    if (isReversed !== undefined) where.isReversed = isReversed === 'true';

    const { count, rows } = await Deduction.findAndCountAll({
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
