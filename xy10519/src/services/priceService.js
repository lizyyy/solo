const { formatPrice, isBetween, BusinessError } = require('../utils/helpers');

const DISCOUNT_PRIORITY = {
  GROUP_BUY: 1,
  OLD_STUDENT: 2,
  COUPON: 3,
};

const ORDER_STATUS = {
  CREATED: 'created',
  PRICE_CALCULATED: 'price_calculated',
  PRICE_LOCKED: 'price_locked',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  COMPLETED: 'completed',
  REFUNDING: 'refunding',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

function calculatePrice(course, user, options = {}) {
  const { coupon: rawCoupon, groupBuy: rawGroupBuy } = options;
  
  const originalPrice = course.original_price;
  let currentPrice = originalPrice;
  const discountDetails = [];
  const appliedDiscounts = [];
  const warnings = [];
  
  let coupon = rawCoupon;
  let groupBuy = rawGroupBuy;
  let oldStudentDiscountApplied = 0;

  if (groupBuy && !isGroupBuyActive(groupBuy)) {
    warnings.push({
      type: 'group_buy_inactive',
      message: `团购活动「${groupBuy.name}」已结束或未开始`,
    });
    groupBuy = null;
  }

  if (coupon && !isCouponValid(coupon, course.id, originalPrice)) {
    warnings.push({
      type: 'coupon_invalid',
      message: `优惠券「${coupon.name}」不可用`,
    });
    coupon = null;
  }

  if (groupBuy && coupon && !coupon.is_stackable) {
    warnings.push({
      type: 'discount_conflict',
      message: `优惠券「${coupon.name}」与团购活动互斥，已选择更优惠的方案`,
    });
    
    const groupBuyPrice = groupBuy.group_price;
    let couponPrice = originalPrice;
    
    if (coupon.type === 'fixed') {
      couponPrice = Math.max(0, originalPrice - coupon.value);
    } else if (coupon.type === 'percentage') {
      couponPrice = originalPrice * (1 - coupon.value / 100);
      if (coupon.max_discount) {
        const maxDiscountPrice = originalPrice - coupon.max_discount;
        couponPrice = Math.max(couponPrice, maxDiscountPrice);
      }
    }
    
    if (groupBuyPrice <= couponPrice) {
      coupon = null;
    } else {
      groupBuy = null;
    }
  }

  if (groupBuy) {
    const groupBuyDiscount = originalPrice - groupBuy.group_price;
    currentPrice = groupBuy.group_price;
    discountDetails.push({
      type: 'group_buy',
      name: groupBuy.name,
      priority: DISCOUNT_PRIORITY.GROUP_BUY,
      originalPrice: originalPrice,
      priceAfter: currentPrice,
      discountAmount: groupBuyDiscount,
      description: `团购价 ${groupBuy.group_price}元（原价${originalPrice}元）`,
    });
    appliedDiscounts.push({ type: 'group_buy', id: groupBuy.id, name: groupBuy.name });
  }

  if (user && user.is_old_student && user.old_student_discount_rate > 0) {
    const oldStudentDiscount = currentPrice * (user.old_student_discount_rate / 100);
    const priceAfterOldStudent = currentPrice - oldStudentDiscount;
    
    if (priceAfterOldStudent < currentPrice) {
      oldStudentDiscountApplied = oldStudentDiscount;
      discountDetails.push({
        type: 'old_student',
        name: '老学员折扣',
        priority: DISCOUNT_PRIORITY.OLD_STUDENT,
        originalPrice: currentPrice,
        priceAfter: priceAfterOldStudent,
        discountAmount: oldStudentDiscount,
        discountRate: user.old_student_discount_rate,
        description: `老学员${user.old_student_discount_rate}%折扣，优惠${formatPrice(oldStudentDiscount)}元`,
      });
      appliedDiscounts.push({ 
        type: 'old_student', 
        discountRate: user.old_student_discount_rate 
      });
      currentPrice = priceAfterOldStudent;
    }
  }

  if (coupon) {
    let couponDiscount = 0;
    let priceAfterCoupon = currentPrice;
    
    if (coupon.type === 'fixed') {
      couponDiscount = Math.min(coupon.value, currentPrice);
      priceAfterCoupon = currentPrice - couponDiscount;
    } else if (coupon.type === 'percentage') {
      couponDiscount = currentPrice * (coupon.value / 100);
      if (coupon.max_discount && couponDiscount > coupon.max_discount) {
        couponDiscount = coupon.max_discount;
      }
      priceAfterCoupon = currentPrice - couponDiscount;
    }
    
    if (priceAfterCoupon < currentPrice) {
      discountDetails.push({
        type: 'coupon',
        name: coupon.name,
        code: coupon.code,
        priority: DISCOUNT_PRIORITY.COUPON,
        originalPrice: currentPrice,
        priceAfter: priceAfterCoupon,
        discountAmount: couponDiscount,
        couponType: coupon.type,
        couponValue: coupon.value,
        description: `使用优惠券「${coupon.name}」，优惠${formatPrice(couponDiscount)}元`,
      });
      appliedDiscounts.push({ type: 'coupon', id: coupon.id, code: coupon.code, name: coupon.name });
      currentPrice = priceAfterCoupon;
    }
  }

  currentPrice = Math.max(0, currentPrice);
  const totalDiscount = originalPrice - currentPrice;

  return {
    originalPrice: formatPrice(originalPrice),
    finalPrice: formatPrice(currentPrice),
    totalDiscount: formatPrice(totalDiscount),
    oldStudentDiscountApplied: formatPrice(oldStudentDiscountApplied),
    discountDetails: discountDetails.sort((a, b) => a.priority - b.priority),
    appliedDiscounts,
    warnings,
    isOldStudent: !!(user && user.is_old_student),
    couponId: coupon?.id,
    groupBuyId: groupBuy?.id,
    calculationSteps: generateCalculationSteps(originalPrice, discountDetails),
    customerExplanation: generateCustomerExplanation(originalPrice, currentPrice, discountDetails, warnings),
  };
}

function isGroupBuyActive(groupBuy) {
  if (!groupBuy) return false;
  if (groupBuy.status !== 'active') return false;
  return isBetween(groupBuy.start_time, groupBuy.end_time);
}

function isCouponValid(coupon, courseId, price) {
  if (!coupon) return false;
  
  if (coupon.total_stock !== -1 && coupon.used_count >= coupon.total_stock) {
    return false;
  }
  
  if (coupon.min_spend && price < coupon.min_spend) {
    return false;
  }
  
  if (!isBetween(coupon.start_time, coupon.end_time)) {
    return false;
  }
  
  if (coupon.applicable_course_ids) {
    const applicableIds = JSON.parse(coupon.applicable_course_ids);
    if (applicableIds.length > 0 && !applicableIds.includes(courseId)) {
      return false;
    }
  }
  
  return true;
}

function generateCalculationSteps(originalPrice, discountDetails) {
  const steps = [];
  let currentPrice = originalPrice;
  
  steps.push({
    step: 1,
    title: '课程原价',
    price: formatPrice(currentPrice),
    description: `课程定价：${formatPrice(originalPrice)}元`,
  });
  
  discountDetails.sort((a, b) => a.priority - b.priority).forEach((detail, index) => {
    steps.push({
      step: index + 2,
      title: getDiscountTypeName(detail.type),
      price: formatPrice(detail.priceAfter),
      discount: formatPrice(detail.discountAmount),
      description: detail.description,
      source: detail.name,
    });
    currentPrice = detail.priceAfter;
  });
  
  steps.push({
    step: steps.length + 1,
    title: '最终应付',
    price: formatPrice(currentPrice),
    description: `共优惠 ${formatPrice(originalPrice - currentPrice)}元，实际应付 ${formatPrice(currentPrice)}元`,
  });
  
  return steps;
}

function getDiscountTypeName(type) {
  const names = {
    'group_buy': '团购优惠',
    'old_student': '老学员折扣',
    'coupon': '优惠券',
  };
  return names[type] || type;
}

function generateCustomerExplanation(originalPrice, finalPrice, discountDetails, warnings) {
  const totalDiscount = originalPrice - finalPrice;
  const parts = [];
  
  parts.push(`您购买的课程原价为 ${formatPrice(originalPrice)}元`);
  
  if (discountDetails.length > 0) {
    const discountNames = discountDetails.map(d => d.name).join('、');
    parts.push(`享受了 ${discountNames} 优惠`);
    parts.push(`共优惠 ${formatPrice(totalDiscount)}元`);
  }
  
  parts.push(`实际应付金额为 ${formatPrice(finalPrice)}元`);
  
  if (warnings && warnings.length > 0) {
    parts.push(`温馨提示：${warnings.map(w => w.message).join('；')}`);
  }
  
  return parts.join('，') + '。';
}

module.exports = {
  calculatePrice,
  isGroupBuyActive,
  isCouponValid,
  ORDER_STATUS,
  DISCOUNT_PRIORITY,
};
