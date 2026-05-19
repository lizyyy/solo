const db = require('../db');
const RuleEngine = require('../rules/engine');
const { OldPartNotReturnedRule, DuplicateClaimRule, BatchTrackingRule } = require('../rules/claimRules');
const { logAction } = require('../utils/audit');

class ClaimService {
  constructor() {
    this.ruleEngine = new RuleEngine();
    this.ruleEngine.addRule(new OldPartNotReturnedRule());
    this.ruleEngine.addRule(new DuplicateClaimRule());
    this.ruleEngine.addRule(new BatchTrackingRule());
  }

  createClaim(claimData) {
    const { vendor_code, vendor_name, claim_date, items } = claimData;

    if (!items || items.length === 0) {
      return { success: false, error: '索赔明细不能为空' };
    }

    const validatedItems = [];
    const failedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const receiveOrder = db.prepare('SELECT * FROM receive_orders WHERE order_no = ?').get(item.receive_order_no);
      if (!receiveOrder) {
        failedItems.push({ ...item, error: '领件单不存在' });
        continue;
      }

      const validationResult = this.ruleEngine.validate({
        ...item,
        receive_order_id: receiveOrder.id,
        batch_no: receiveOrder.batch_no,
      }, 'claim_item');

      if (!validationResult.passed) {
        failedItems.push({
          ...item,
          error: '规则校验失败',
          ruleResults: validationResult.results,
        });
        continue;
      }

      const amount = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || receiveOrder.quantity);
      totalAmount += amount;

      validatedItems.push({
        ...item,
        receive_order_id: receiveOrder.id,
        part_code: receiveOrder.part_code,
        part_name: receiveOrder.part_name,
        batch_no: receiveOrder.batch_no,
        quantity: parseInt(item.quantity) || receiveOrder.quantity,
        unit_price: parseFloat(item.unit_price) || 0,
        amount,
      });
    }

    if (validatedItems.length === 0) {
      return {
        success: false,
        error: '没有通过规则校验的索赔明细',
        failedItems,
      };
    }

    const claimNo = `CL${Date.now()}`;

    try {
      db.exec('BEGIN TRANSACTION');

      const insertClaim = db.prepare(`
        INSERT INTO claims (claim_no, vendor_code, vendor_name, claim_date, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const claimResult = insertClaim.run(
        claimNo,
        vendor_code,
        vendor_name,
        claim_date || new Date().toISOString().split('T')[0],
        totalAmount,
        'submitted'
      );

      const claimId = claimResult.lastInsertRowid;

      const insertClaimItem = db.prepare(`
        INSERT INTO claim_items 
        (claim_id, receive_order_id, part_code, part_name, batch_no, quantity, unit_price, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateReceiveOrder = db.prepare(`
        UPDATE receive_orders SET claim_status = 'claimed', claim_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);

      for (const item of validatedItems) {
        insertClaimItem.run(
          claimId,
          item.receive_order_id,
          item.part_code,
          item.part_name,
          item.batch_no,
          item.quantity,
          item.unit_price,
          item.amount
        );
        updateReceiveOrder.run(claimId, item.receive_order_id);
      }

      db.exec('COMMIT');

      logAction('create', 'claim', {
        entityId: claimId,
        entityNo: claimNo,
        afterData: { ...claimData, claim_no: claimNo, totalAmount },
      });

      return {
        success: true,
        claimNo,
        validatedItems,
        failedItems,
        totalAmount,
      };
    } catch (error) {
      db.exec('ROLLBACK');
      return { success: false, error: error.message };
    }
  }

  getClaims(filters = {}) {
    let sql = 'SELECT * FROM claims WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.vendor_code) {
      sql += ' AND vendor_code = ?';
      params.push(filters.vendor_code);
    }

    sql += ' ORDER BY created_at DESC';

    return db.prepare(sql).all(...params);
  }

  getClaimItems(claimId) {
    return db.prepare('SELECT * FROM claim_items WHERE claim_id = ?').all(claimId);
  }

  getRuleResults(dataNo) {
    return this.ruleEngine.getResultsByDataNo(dataNo);
  }
}

module.exports = new ClaimService();
