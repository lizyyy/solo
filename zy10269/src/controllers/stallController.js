const { Stall, Op } = require('../models');
const Joi = require('joi');

const stallSchema = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  ownerName: Joi.string().required(),
  phone: Joi.string().optional(),
  area: Joi.string().optional(),
  baseDiscountRate: Joi.number().min(0).max(1).default(0.9)
});

exports.createStall = async (req, res) => {
  try {
    const { error, value } = stallSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingStall = await Stall.findOne({ where: { code: value.code } });
    if (existingStall) {
      return res.status(400).json({ error: '摊位编号已存在' });
    }

    const stall = await Stall.create(value);
    res.status(201).json(stall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStalls = async (req, res) => {
  try {
    const { page = 1, limit = 10, code, name, area } = req.query;
    const where = {};

    if (code) where.code = { [Op.like]: `%${code}%` };
    if (name) where.name = { [Op.like]: `%${name}%` };
    if (area) where.area = { [Op.like]: `%${area}%` };

    const { count, rows } = await Stall.findAndCountAll({
      where,
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

exports.getStall = async (req, res) => {
  try {
    const stall = await Stall.findByPk(req.params.id);
    if (!stall) {
      return res.status(404).json({ error: '摊位不存在' });
    }
    res.json(stall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStall = async (req, res) => {
  try {
    const stall = await Stall.findByPk(req.params.id);
    if (!stall) {
      return res.status(404).json({ error: '摊位不存在' });
    }

    const { error, value } = stallSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (value.code !== stall.code) {
      const existingStall = await Stall.findOne({ where: { code: value.code } });
      if (existingStall) {
        return res.status(400).json({ error: '摊位编号已存在' });
      }
    }

    await stall.update(value);
    res.json(stall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteStall = async (req, res) => {
  try {
    const stall = await Stall.findByPk(req.params.id);
    if (!stall) {
      return res.status(404).json({ error: '摊位不存在' });
    }

    await stall.update({ isActive: false });
    res.json({ message: '摊位已禁用' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
