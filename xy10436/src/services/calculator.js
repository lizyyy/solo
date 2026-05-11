const db = require('../db');

const calculateDiscount = (discountType, discountValue, amount) => {
  if (discountType === 'fixed') {
    return Math.min(discountValue, amount);
  } else if (discountType === 'percentage') {
    return Math.floor(amount * discountValue / 100 * 100) / 100;
  }
  return 0;
};

const checkCouponUsage = (userId, couponId) => {
  const usage = db.prepare(`
    SELECT id FROM coupon_usage 
    WHERE user_id = ? AND coupon_id = ? AND status = 'used'
  `).get(userId, couponId);
  return !usage;
};

const checkCouponStock = (couponId) => {
  const coupon = db.prepare('SELECT stock FROM coupons WHERE id = ?').get(couponId);
  if (!coupon) return false;
  if (coupon.stock === -1) return true;
  
  const usedCount = db.prepare(`
    SELECT COUNT(*) as count FROM coupon_usage 
    WHERE coupon_id = ? AND status = 'used'
  `).get(couponId).count;
  
  return usedCount < coupon.stock;
};

const checkGiftStock = (giftId, quantity) => {
  const gift = db.prepare('SELECT stock, gift_quantity FROM gifts WHERE id = ?').get(giftId);
  if (!gift) return false;
  return gift.stock >= quantity;
};

const findApplicableFullReduction = (streamId, totalAmount) => {
  const reductions = db.prepare(`
    SELECT * FROM full_reductions 
    WHERE stream_id = ? AND threshold_amount <= ?
    ORDER BY priority DESC, threshold_amount DESC
  `).all(streamId, totalAmount);
  
  if (reductions.length > 0) {
    return reductions[0];
  }
  return null;
};

const findApplicableGifts = (streamId, totalAmount) => {
  return db.prepare(`
    SELECT * FROM gifts 
    WHERE stream_id = ? AND threshold_amount <= ?
    ORDER BY threshold_amount DESC
  `).all(streamId, totalAmount);
};

const validatePromotions = (streamId, totalAmount, platformCouponId, anchorCouponId, userId) => {
  const conflicts = [];
  const validCoupons = [];

  if (platformCouponId) {
    const platformCoupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND type = "platform"').get(platformCouponId);
    if (!platformCoupon) {
      conflicts.push({ type: 'coupon', id: platformCouponId, message: '平台券不存在' });
    } else if (totalAmount < platformCoupon.min_amount) {
      conflicts.push({ type: 'coupon', id: platformCouponId, message: '未达到平台券使用门槛' });
    } else if (!checkCouponUsage(userId, platformCouponId)) {
      conflicts.push({ type: 'coupon', id: platformCouponId, message: '平台券已使用' });
    } else if (!checkCouponStock(platformCouponId)) {
      conflicts.push({ type: 'coupon', id: platformCouponId, message: '平台券库存不足' });
    } else {
      validCoupons.push(platformCoupon);
    }
  }

  if (anchorCouponId) {
    const anchorCoupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND type = "anchor"').get(anchorCouponId);
    if (!anchorCoupon) {
      conflicts.push({ type: 'coupon', id: anchorCouponId, message: '主播券不存在' });
    } else if (anchorCoupon.stream_id !== streamId) {
      conflicts.push({ type: 'coupon', id: anchorCouponId, message: '主播券不属于当前直播' });
    } else if (totalAmount < anchorCoupon.min_amount) {
      conflicts.push({ type: 'coupon', id: anchorCouponId, message: '未达到主播券使用门槛' });
    } else if (!checkCouponUsage(userId, anchorCouponId)) {
      conflicts.push({ type: 'coupon', id: anchorCouponId, message: '主播券已使用' });
    } else if (!checkCouponStock(anchorCouponId)) {
      conflicts.push({ type: 'coupon', id: anchorCouponId, message: '主播券库存不足' });
    } else {
      validCoupons.push(anchorCoupon);
    }
  }

  if (validCoupons.length >= 2) {
    const hasMutualExclusive = validCoupons.some(c => c.is_mutual_exclusive === 1);
    if (hasMutualExclusive) {
      conflicts.push({ type: 'mutual_exclusive', message: '优惠券之间存在互斥关系，只能使用一张' });
      return { valid: false, conflicts, validCoupons: [] };
    }
  }

  return { valid: conflicts.length === 0, conflicts, validCoupons };
};

const calculateOrder = (items, streamId, platformCouponId, anchorCouponId, userId) => {
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND stream_id = ?').get(item.product_id, streamId);
    if (!product) {
      return { error: `商品 ${item.product_id} 不存在或不属于当前直播` };
    }
    if (product.stock < item.quantity) {
      return { error: `商品 "${product.name}" 库存不足，当前库存: ${product.stock}` };
    }

    const itemTotal = product.price * item.quantity;
    totalAmount += itemTotal;
    orderItems.push({
      ...item,
      product,
      total_price: itemTotal
    });
  }

  const validation = validatePromotions(streamId, totalAmount, platformCouponId, anchorCouponId, userId);
  if (!validation.valid) {
    return { error: '优惠规则冲突', details: validation.conflicts };
  }

  let remainingAmount = totalAmount;
  let totalDiscount = 0;
  const appliedPromotions = [];

  for (const coupon of validation.validCoupons) {
    const discount = calculateDiscount(coupon.discount_type, coupon.discount_value, remainingAmount);
    if (discount > 0) {
      totalDiscount += discount;
      remainingAmount -= discount;
      appliedPromotions.push({
        type: coupon.type === 'platform' ? 'coupon_platform' : 'coupon_anchor',
        id: coupon.id,
        name: coupon.name,
        discount_amount: discount
      });
    }
  }

  const fullReduction = findApplicableFullReduction(streamId, remainingAmount);
  if (fullReduction) {
    totalDiscount += fullReduction.discount_amount;
    remainingAmount -= fullReduction.discount_amount;
    appliedPromotions.push({
      type: 'full_reduction',
      id: fullReduction.id,
      name: fullReduction.name,
      discount_amount: fullReduction.discount_amount
    });
  }

  const applicableGifts = findApplicableGifts(streamId, totalAmount);
  const gifts = [];
  for (const gift of applicableGifts) {
    if (checkGiftStock(gift.id, gift.gift_quantity)) {
      gifts.push({
        gift_rule_id: gift.id,
        gift_product_id: gift.gift_product_id,
        gift_quantity: gift.gift_quantity,
        name: gift.name
      });
    }
  }

  const discountPerItem = orderItems.map(item => {
    const ratio = item.total_price / totalAmount;
    const itemDiscount = Math.floor(totalDiscount * ratio * 100) / 100;
    return {
      ...item,
      discount_amount: itemDiscount,
      pay_amount: item.total_price - itemDiscount
    };
  });

  return {
    stream_id: streamId,
    items: discountPerItem,
    total_amount: totalAmount,
    discount_amount: totalDiscount,
    pay_amount: Math.max(0, remainingAmount),
    applied_promotions: appliedPromotions,
    gifts: gifts
  };
};

module.exports = {
  calculateOrder,
  checkCouponUsage,
  checkCouponStock,
  checkGiftStock,
  findApplicableFullReduction,
  findApplicableGifts
};
