const {
  Stall,
  Deduction,
  MonthlyDiscount,
  DiscountAdjustment,
  Review,
  Complaint,
  Op,
  sequelize
} = require('../models');
const moment = require('moment');

const MAX_POINTS_LIMIT = 20;
const BASE_DISCOUNT_RATE = 0.9;

function generateNo(prefix) {
  return `${prefix}${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
}

async function calculateMonthlyPoints(stallId, month) {
  const deductions = await Deduction.findAll({
    where: {
      stallId,
      month,
      isReversed: false
    }
  });

  let totalPoints = deductions.reduce((sum, d) => sum + d.points, 0);

  const reviews = await Review.findAll({
    where: {
      stallId,
      result: 'pass'
    },
    include: [{
      model: require('../models').Rectification,
      include: [{
        model: require('../models').Inspection,
        where: { month }
      }]
    }]
  });

  const returnedPoints = reviews.reduce((sum, r) => sum + r.pointsReturned, 0);
  totalPoints = Math.max(0, totalPoints - returnedPoints);

  return totalPoints;
}

async function calculateDiscountRate(totalPoints) {
  if (totalPoints >= MAX_POINTS_LIMIT) {
    return { rate: 1.0, isEligible: false };
  }

  const reduction = (totalPoints / MAX_POINTS_LIMIT) * 0.1;
  const rate = Math.max(BASE_DISCOUNT_RATE, 1.0 - reduction);
  
  return {
    rate: parseFloat(rate.toFixed(2)),
    isEligible: totalPoints < MAX_POINTS_LIMIT
  };
}

async function createDiscountAdjustment(stallId, month, sourceType, sourceId, sourceDescription, pointsChange, operator) {
  const stall = await Stall.findByPk(stallId);
  if (!stall) {
    throw new Error('摊位不存在');
  }

  const [monthlyDiscount, created] = await MonthlyDiscount.findOrCreate({
    where: { stallId, month },
    defaults: {
      discountRate: stall.baseDiscountRate,
      totalPoints: 0,
      isEligible: true,
      maxPointsLimit: MAX_POINTS_LIMIT
    }
  });

  const totalPoints = await calculateMonthlyPoints(stallId, month);
  const { rate, isEligible } = await calculateDiscountRate(totalPoints);

  const beforeRate = monthlyDiscount.discountRate;

  const adjustment = await DiscountAdjustment.create({
    adjustmentNo: generateNo('ADJ'),
    stallId,
    month,
    sourceType,
    sourceId: String(sourceId),
    sourceDescription,
    beforeRate,
    afterRate: rate,
    pointsChange,
    totalPoints,
    operator
  });

  await monthlyDiscount.update({
    totalPoints,
    discountRate: rate,
    isEligible,
    isCalculated: true,
    calculatedAt: new Date()
  });

  return { adjustment, monthlyDiscount };
}

async function recalculateMonthlyDiscount(stallId, month, operator = 'system') {
  const monthlyDiscount = await MonthlyDiscount.findOne({
    where: { stallId, month }
  });

  if (monthlyDiscount && monthlyDiscount.isLocked) {
    throw new Error('该月份数据已锁定，无法重新计算');
  }

  return await createDiscountAdjustment(
    stallId,
    month,
    'recalculation',
    null,
    `月度优惠重新计算 - ${month}`,
    0,
    operator
  );
}

async function handleDeductionCreated(deduction) {
  return await createDiscountAdjustment(
    deduction.stallId,
    deduction.month,
    'deduction',
    deduction.id,
    `卫生扣分: ${deduction.reason} (-${deduction.points}分)`,
    -deduction.points,
    'system'
  );
}

async function handleComplaintUpheld(complaint, deduction) {
  return await createDiscountAdjustment(
    complaint.stallId,
    deduction.month,
    'complaint_reversal',
    complaint.id,
    `投诉成立，撤销扣分: ${deduction.reason} (+${deduction.points}分)`,
    deduction.points,
    'system'
  );
}

async function handleReviewPass(review) {
  return await createDiscountAdjustment(
    review.stallId,
    moment(review.reviewedAt).format('YYYY-MM'),
    'review_pass',
    review.id,
    `整改复核通过，返还分数 (+${review.pointsReturned}分)`,
    review.pointsReturned,
    review.reviewer
  );
}

async function getStallDiscount(stallId, month) {
  const monthlyDiscount = await MonthlyDiscount.findOne({
    where: { stallId, month }
  });

  if (!monthlyDiscount) {
    const stall = await Stall.findByPk(stallId);
    return {
      stallId,
      month,
      totalPoints: 0,
      discountRate: stall ? stall.baseDiscountRate : BASE_DISCOUNT_RATE,
      isEligible: true,
      isCalculated: false
    };
  }

  return monthlyDiscount;
}

async function getStallDiscountHistory(stallId) {
  return await DiscountAdjustment.findAll({
    where: { stallId },
    order: [['createdAt', 'DESC']]
  });
}

async function lockMonthlyData(month) {
  const result = await MonthlyDiscount.update(
    { isLocked: true },
    { where: { month, isCalculated: true } }
  );

  await require('../models').Inspection.update(
    { isLocked: true },
    { where: { month } }
  );

  return result;
}

async function getRanking(month, limit = 10) {
  const discounts = await MonthlyDiscount.findAll({
    where: { month },
    include: [{ model: Stall }],
    order: [['totalPoints', 'ASC'], ['discountRate', 'ASC']],
    limit
  });

  return discounts.map((d, index) => ({
    rank: index + 1,
    stallId: d.stallId,
    stallCode: d.Stall.code,
    stallName: d.Stall.name,
    totalPoints: d.totalPoints,
    discountRate: d.discountRate,
    isEligible: d.isEligible
  }));
}

module.exports = {
  calculateMonthlyPoints,
  calculateDiscountRate,
  createDiscountAdjustment,
  recalculateMonthlyDiscount,
  handleDeductionCreated,
  handleComplaintUpheld,
  handleReviewPass,
  getStallDiscount,
  getStallDiscountHistory,
  lockMonthlyData,
  getRanking,
  MAX_POINTS_LIMIT,
  BASE_DISCOUNT_RATE
};
