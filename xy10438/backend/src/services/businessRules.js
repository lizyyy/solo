const db = require('../database');
const dayjs = require('dayjs');

const businessRules = {
  checkEffectTime: (effectTime) => {
    const now = dayjs();
    const effect = dayjs(effectTime);
    if (now.isBefore(effect)) {
      throw new Error('未到生效时间，不能确认换签');
    }
    return true;
  },

  checkDuplicateAdjustment: (productId, effectTime, excludeAdjustmentId = null) => {
    let whereClause = 'pai.product_id = ? AND pa.status != ?';
    let params = [productId, 'cancelled'];

    if (excludeAdjustmentId) {
      whereClause = 'pa.id != ? AND ' + whereClause;
      params = [excludeAdjustmentId, productId, 'cancelled'];
    }

    const existingAdjustments = db.all(`
      SELECT pa.*, pai.new_price, pai.original_price
      FROM price_adjustments pa
      JOIN price_adjustment_items pai ON pa.id = pai.adjustment_id
      WHERE ${whereClause}
      ORDER BY pa.effect_time DESC
    `, params);

    const effect = dayjs(effectTime);
    
    for (const adj of existingAdjustments) {
      const adjEffect = dayjs(adj.effect_time);
      const adjExpire = adj.expire_time ? dayjs(adj.expire_time) : null;
      
      if (!adjExpire || effect.isBefore(adjExpire)) {
        if (effect.isAfter(adjEffect) || effect.isSame(adjEffect, 'day')) {
          throw new Error(`商品存在冲突的调价单（单号：${adj.adjustment_no}，生效时间：${adjEffect.format('YYYY-MM-DD HH:mm')}）`);
        }
      }
    }

    return true;
  },

  checkModifyAfterConfirm: (adjustmentId) => {
    const result = db.get(`
      SELECT COUNT(*) as count 
      FROM store_tasks 
      WHERE adjustment_id = ? AND status IN ('confirmed', 'partial_confirmed')
    `, [adjustmentId]);

    if (result && result.count > 0) {
      throw new Error('已有门店确认换签，不能修改调价单');
    }

    return true;
  },

  checkAllStoresConfirmed: (adjustmentId) => {
    const tasks = db.all(`
      SELECT status FROM store_tasks WHERE adjustment_id = ?
    `, [adjustmentId]);

    if (tasks.length === 0) {
      return false;
    }

    const allConfirmed = tasks.every(task => task.status === 'confirmed');
    return allConfirmed;
  }
};

module.exports = businessRules;
