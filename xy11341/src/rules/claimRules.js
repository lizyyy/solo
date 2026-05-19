const db = require('../db');

class OldPartNotReturnedRule {
  constructor() {
    this.type = 'claim';
    this.name = 'old_part_not_returned';
    this.dataType = 'claim_item';
  }

  validate(data) {
    const receiveOrder = db.prepare('SELECT old_part_returned FROM receive_orders WHERE id = ?').get(data.receive_order_id);
    
    if (!receiveOrder) {
      return { passed: false, reason: '领件单不存在', details: { receive_order_id: data.receive_order_id } };
    }

    if (receiveOrder.old_part_returned === 0) {
      return { passed: false, reason: '旧件未返还，无法索赔', details: { receive_order_id: data.receive_order_id } };
    }

    return { passed: true, reason: '旧件已返还，符合索赔条件' };
  }
}

class DuplicateClaimRule {
  constructor() {
    this.type = 'claim';
    this.name = 'duplicate_claim';
    this.dataType = 'claim_item';
  }

  validate(data) {
    const existingClaim = db.prepare(`
      SELECT ci.*, c.claim_no, c.status 
      FROM claim_items ci
      JOIN claims c ON ci.claim_id = c.id
      WHERE ci.receive_order_id = ? AND c.status != 'cancelled'
    `).get(data.receive_order_id);

    if (existingClaim) {
      return { 
        passed: false, 
        reason: '该领件单已存在索赔记录', 
        details: { existing_claim_no: existingClaim.claim_no, status: existingClaim.status } 
      };
    }

    return { passed: true, reason: '无重复索赔记录' };
  }
}

class BatchTrackingRule {
  constructor() {
    this.type = 'claim';
    this.name = 'batch_tracking';
    this.dataType = 'claim_item';
  }

  validate(data) {
    if (!data.batch_no || data.batch_no.trim() === '') {
      return { passed: false, reason: '批次号不能为空' };
    }

    const receiveOrder = db.prepare('SELECT batch_no FROM receive_orders WHERE id = ?').get(data.receive_order_id);
    
    if (!receiveOrder) {
      return { passed: false, reason: '领件单不存在' };
    }

    if (receiveOrder.batch_no !== data.batch_no) {
      return { 
        passed: false, 
        reason: '索赔批次号与领件批次号不一致', 
        details: { claim_batch: data.batch_no, receive_batch: receiveOrder.batch_no } 
      };
    }

    return { passed: true, reason: '批次信息一致' };
  }
}

module.exports = {
  OldPartNotReturnedRule,
  DuplicateClaimRule,
  BatchTrackingRule,
};
