const { Complaint, Inspection, Deduction, Stall, sequelize } = require('../models');
const Joi = require('joi');
const moment = require('moment');
const discountService = require('../services/discountService');

function generateNo(prefix) {
  return `${prefix}${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
}

const complaintSchema = Joi.object({
  inspectionId: Joi.number().required(),
  stallId: Joi.number().required(),
  complainant: Joi.string().required(),
  reason: Joi.string().required()
});

const handleComplaintSchema = Joi.object({
  handler: Joi.string().required(),
  status: Joi.string().valid('upheld', 'rejected').required(),
  handleResult: Joi.string().required()
});

exports.createComplaint = async (req, res) => {
  try {
    const { error, value } = complaintSchema.validate(req.body);
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

    const existingComplaint = await Complaint.findOne({
      where: { inspectionId: value.inspectionId }
    });

    if (existingComplaint) {
      return res.status(400).json({ error: '该检查记录已存在投诉，请勿重复投诉' });
    }

    const complaint = await Complaint.create({
      ...value,
      complaintNo: generateNo('COMP'),
      status: 'pending'
    });

    await inspection.update({ status: 'complained' });

    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10, stallId, status } = req.query;
    const where = {};

    if (stallId) where.stallId = stallId;
    if (status) where.status = status;

    const { count, rows } = await Complaint.findAndCountAll({
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

exports.handleComplaint = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { error, value } = handleComplaintSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const complaint = await Complaint.findByPk(req.params.id);
    if (!complaint) {
      await transaction.rollback();
      return res.status(404).json({ error: '投诉记录不存在' });
    }

    if (complaint.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ error: '该投诉已处理，无法重复处理' });
    }

    const inspection = await Inspection.findByPk(complaint.inspectionId);

    if (inspection.isLocked) {
      await transaction.rollback();
      return res.status(400).json({ error: `该检查记录所属月份 ${inspection.month} 已锁定，无法处理投诉` });
    }

    const { MonthlyDiscount } = require('../models');
    const monthlyDiscount = await MonthlyDiscount.findOne({
      where: { stallId: complaint.stallId, month: inspection.month }
    });

    if (monthlyDiscount && monthlyDiscount.isLocked) {
      await transaction.rollback();
      return res.status(400).json({ error: `该摊位 ${inspection.month} 的优惠数据已锁定，无法处理投诉` });
    }

    await complaint.update({
      ...value,
      handledAt: new Date()
    }, { transaction });

    if (value.status === 'upheld') {
      const deduction = await Deduction.findOne({
        where: { inspectionId: complaint.inspectionId }
      });

      if (deduction) {
        await deduction.update({
          isReversed: true,
          reversedReason: value.handleResult,
          reversedAt: new Date()
        }, { transaction });

        await discountService.handleComplaintUpheld(complaint, deduction);
      }
    }

    await inspection.update({ status: 'deducted' }, { transaction });

    await transaction.commit();

    res.json({ complaint });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
};
