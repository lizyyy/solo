const database = require('../database');
const { generateId, now, RESPONSIBILITIES, lockManager, AuditLog } = require('../utils');

class CostService {
  addCost(repairOrderId, costData, operator = 'system') {
    const { responsibility, cost_type, amount, currency, description } = costData;

    if (!responsibility || !cost_type || !amount) {
      throw new Error('责任方、费用类型和金额不能为空');
    }
    if (!RESPONSIBILITIES.includes(responsibility)) {
      throw new Error(`责任方必须是: ${RESPONSIBILITIES.join(', ')}`);
    }
    if (amount <= 0) {
      throw new Error('金额必须大于0');
    }

    return database.runTransaction(() => {
      const order = database.prepare('SELECT * FROM repair_orders WHERE id = ?').get(repairOrderId);
      if (!order) {
        throw new Error('返修单不存在');
      }

      const id = generateId();
      const nowTime = now();

      database.prepare(`
        INSERT INTO cost_records 
        (id, repair_order_id, responsibility, cost_type, amount, currency, description, recorded_at, recorded_by, is_settled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(id, repairOrderId, responsibility, cost_type, amount, currency || 'CNY', description || null, nowTime, operator);

      AuditLog.log('COST', 'ADD', repairOrderId, operator, {
        cost_id: id,
        responsibility,
        cost_type,
        amount,
        currency: currency || 'CNY'
      });

      return {
        id,
        repair_order_id: repairOrderId,
        responsibility,
        cost_type,
        amount,
        currency: currency || 'CNY',
        description,
        recorded_at: nowTime,
        is_settled: 0
      };
    });
  }

  listCosts(filter = {}) {
    let sql = 'SELECT * FROM cost_records WHERE 1=1';
    const params = [];

    if (filter.repair_order_id) {
      sql += ' AND repair_order_id = ?';
      params.push(filter.repair_order_id);
    }
    if (filter.responsibility) {
      sql += ' AND responsibility = ?';
      params.push(filter.responsibility);
    }
    if (filter.is_settled !== undefined && filter.is_settled !== null) {
      sql += ' AND is_settled = ?';
      params.push(filter.is_settled ? 1 : 0);
    }
    if (filter.settlement_batch) {
      sql += ' AND settlement_batch = ?';
      params.push(filter.settlement_batch);
    }

    sql += ' ORDER BY recorded_at DESC';
    let results = database.prepare(sql).all(...params);
    
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return results.slice(offset, offset + limit);
  }

  getUnsettledCostsByResponsibility() {
    const results = [];
    for (const resp of RESPONSIBILITIES) {
      const costs = database.prepare(`
        SELECT * FROM cost_records 
        WHERE responsibility = ? AND is_settled = 0
        ORDER BY recorded_at ASC
      `).all(resp);
      
      if (costs.length > 0) {
        const total = costs.reduce((sum, c) => sum + c.amount, 0);
        results.push({
          responsibility: resp,
          total_amount: total,
          cost_count: costs.length,
          costs: costs
        });
      }
    }
    return results;
  }

  createSettlementBatch(responsibility, operator = 'system') {
    if (!RESPONSIBILITIES.includes(responsibility)) {
      throw new Error(`责任方必须是: ${RESPONSIBILITIES.join(', ')}`);
    }

    const lockKey = `settlement:${responsibility}`;
    const lockHolder = generateId();

    const lockResult = lockManager.acquire(lockKey, lockHolder, 30000);
    if (!lockResult.success) {
      throw new Error('该责任方正有结算处理中，请稍后重试');
    }

    try {
      return database.runTransaction(() => {
        const unsettledCosts = database.prepare(`
          SELECT * FROM cost_records 
          WHERE responsibility = ? AND is_settled = 0
          ORDER BY recorded_at ASC
        `).all(responsibility);

        if (unsettledCosts.length === 0) {
          throw new Error('该责任方没有待结算的费用');
        }

        const batchId = generateId();
        const totalAmount = unsettledCosts.reduce((sum, c) => sum + c.amount, 0);
        const nowTime = now();
        const currency = unsettledCosts[0].currency || 'CNY';

        database.prepare(`
          INSERT INTO settlement_batches 
          (id, responsibility, total_amount, currency, cost_count, created_at, created_by, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).run(batchId, responsibility, totalAmount, currency, unsettledCosts.length, nowTime, operator);

        const updateStmt = database.prepare(`
          UPDATE cost_records 
          SET is_settled = 1, settled_at = ?, settlement_batch = ?
          WHERE id = ?
        `);

        for (const cost of unsettledCosts) {
          updateStmt.run(nowTime, batchId, cost.id);
        }

        AuditLog.log('SETTLEMENT', 'CREATE_BATCH', batchId, operator, {
          responsibility,
          total_amount: totalAmount,
          cost_count: unsettledCosts.length
        });

        return {
          batch_id: batchId,
          responsibility,
          total_amount: totalAmount,
          currency,
          cost_count: unsettledCosts.length,
          created_at: nowTime,
          status: 'PENDING',
          cost_ids: unsettledCosts.map(c => c.id)
        };
      });
    } finally {
      lockManager.release(lockKey, lockHolder);
    }
  }

  listSettlementBatches(filter = {}) {
    let sql = 'SELECT * FROM settlement_batches WHERE 1=1';
    const params = [];

    if (filter.responsibility) {
      sql += ' AND responsibility = ?';
      params.push(filter.responsibility);
    }
    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY created_at DESC';
    let results = database.prepare(sql).all(...params);
    
    const offset = filter.offset || 0;
    const limit = filter.limit || 20;
    return results.slice(offset, offset + limit);
  }

  getSettlementBatch(batchId) {
    const batch = database.prepare('SELECT * FROM settlement_batches WHERE id = ?').get(batchId);
    if (!batch) return null;

    const costs = database.prepare('SELECT * FROM cost_records WHERE settlement_batch = ?').all(batchId);
    return { ...batch, costs };
  }

  confirmSettlementBatch(batchId, operator = 'system') {
    return database.runTransaction(() => {
      const batch = database.prepare('SELECT * FROM settlement_batches WHERE id = ?').get(batchId);
      if (!batch) {
        throw new Error('结算批次不存在');
      }
      if (batch.status !== 'PENDING') {
        throw new Error('该批次已处理');
      }

      database.prepare(`
        UPDATE settlement_batches 
        SET status = 'CONFIRMED'
        WHERE id = ?
      `).run(batchId);

      AuditLog.log('SETTLEMENT', 'CONFIRM', batchId, operator, {
        responsibility: batch.responsibility,
        total_amount: batch.total_amount
      });

      return {
        success: true,
        message: '结算批次已确认',
        batch_id: batchId
      };
    });
  }
}

module.exports = new CostService();
