const discountService = require('../services/discountService');
const Joi = require('joi');

const recalculateSchema = Joi.object({
  month: Joi.string().required()
});

const lockSchema = Joi.object({
  month: Joi.string().required()
});

exports.getStallDiscount = async (req, res) => {
  try {
    const { stallId, month } = req.params;
    const discount = await discountService.getStallDiscount(stallId, month);
    res.json(discount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStallDiscountHistory = async (req, res) => {
  try {
    const { stallId } = req.params;
    const history = await discountService.getStallDiscountHistory(stallId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.recalculateMonthlyDiscount = async (req, res) => {
  try {
    const { error, value } = recalculateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { stallId } = req.params;
    const result = await discountService.recalculateMonthlyDiscount(
      stallId,
      value.month,
      req.body.operator || 'system'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.lockMonthlyData = async (req, res) => {
  try {
    const { error, value } = lockSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await discountService.lockMonthlyData(value.month);
    res.json({ message: `已锁定 ${value.month} 的数据`, affected: result[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRanking = async (req, res) => {
  try {
    const { month, limit = 10 } = req.query;
    if (!month) {
      return res.status(400).json({ error: '月份参数是必需的' });
    }

    const ranking = await discountService.getRanking(month, parseInt(limit));
    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDiscountConfig = async (req, res) => {
  res.json({
    maxPointsLimit: discountService.MAX_POINTS_LIMIT,
    baseDiscountRate: discountService.BASE_DISCOUNT_RATE
  });
};
