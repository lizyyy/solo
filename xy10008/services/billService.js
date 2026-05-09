const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const { logAudit, OPERATIONS, ENTITY_TYPES } = require('../utils/audit');

const CONCURRENCY_ERROR = 'CONCURRENCY_CONFLICT';

class BillService {
  static validateBillData(data) {
    if (!data.description || !data.description.trim()) {
      throw new Error('Bill description is required');
    }
    
    if (!data.total_amount || isNaN(data.total_amount) || data.total_amount <= 0) {
      throw new Error('Valid total amount is required');
    }
    
    if (!data.payer_id) {
      throw new Error('Payer ID is required');
    }
    
    if (!data.splits || !Array.isArray(data.splits) || data.splits.length === 0) {
      throw new Error('At least one split is required');
    }
    
    const splitTotal = data.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    const precision = 0.01;
    
    if (Math.abs(splitTotal - data.total_amount) > precision) {
      throw new Error(`Split amounts (${splitTotal.toFixed(2)}) must equal total amount (${data.total_amount.toFixed(2)})`);
    }
    
    const payer = db.prepare('SELECT id FROM users WHERE id = ?').get(data.payer_id);
    if (!payer) {
      throw new Error('Payer not found');
    }
    
    for (const split of data.splits) {
      if (!split.user_id) {
        throw new Error('Each split must have a user_id');
      }
      
      if (!split.amount || isNaN(split.amount) || split.amount < 0) {
        throw new Error('Each split must have a valid non-negative amount');
      }
      
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(split.user_id);
      if (!user) {
        throw new Error(`User ${split.user_id} not found`);
      }
    }
    
    const userIds = new Set();
    for (const split of data.splits) {
      if (userIds.has(split.user_id)) {
        throw new Error(`Duplicate user_id in splits: ${split.user_id}`);
      }
      userIds.add(split.user_id);
    }
    
    return true;
  }

  static getBillById(id) {
    try {
      const bill = db.prepare(`
        SELECT * FROM bills WHERE id = ? AND is_deleted = 0
      `).get(id);
      
      if (!bill) {
        return null;
      }
      
      const splits = db.prepare(`
        SELECT * FROM bill_splits WHERE bill_id = ?
      `).all(id);
      
      return {
        ...bill,
        splits
      };
    } catch (error) {
      logger.error('Failed to get bill by id', { error: error.message, billId: id });
      throw error;
    }
  }

  static getAllBills(limit = 100, offset = 0, includeDeleted = false) {
    try {
      let query = `SELECT * FROM bills `;
      const params = [];
      
      if (!includeDeleted) {
        query += 'WHERE is_deleted = 0 ';
      }
      
      query += 'ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const bills = db.prepare(query).all(...params);
      
      return bills.map(bill => {
        const splits = db.prepare(`
          SELECT * FROM bill_splits WHERE bill_id = ?
        `).all(bill.id);
        
        return {
          ...bill,
          splits
        };
      });
    } catch (error) {
      logger.error('Failed to get all bills', { error: error.message });
      throw error;
    }
  }

  static createBill(data, req = {}) {
    this.validateBillData(data);
    
    const transaction = db.transaction(() => {
      const now = Date.now();
      const billId = uuidv4();
      
      db.prepare(`
        INSERT INTO bills (
          id, description, total_amount, payer_id, 
          created_at, updated_at, version, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      `).run(
        billId,
        data.description.trim(),
        parseFloat(data.total_amount),
        data.payer_id,
        now,
        now
      );
      
      const insertSplit = db.prepare(`
        INSERT INTO bill_splits (id, bill_id, user_id, amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const split of data.splits) {
        insertSplit.run(
          uuidv4(),
          billId,
          split.user_id,
          parseFloat(split.amount),
          now
        );
      }
      
      const bill = this.getBillById(billId);
      
      logAudit(OPERATIONS.CREATE, ENTITY_TYPES.BILL, billId, null, bill, req);
      
      return bill;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to create bill', { error: error.message });
      throw error;
    }
  }

  static updateBill(id, data, req = {}) {
    this.validateBillData(data);
    
    const transaction = db.transaction(() => {
      const existingBill = db.prepare(`
        SELECT * FROM bills WHERE id = ? AND is_deleted = 0
      `).get(id);
      
      if (!existingBill) {
        throw new Error('Bill not found');
      }
      
      if (data.version !== undefined && data.version !== existingBill.version) {
        const error = new Error('Bill has been modified by another user. Please refresh and try again.');
        error.code = CONCURRENCY_ERROR;
        error.expectedVersion = data.version;
        error.currentVersion = existingBill.version;
        throw error;
      }
      
      const now = Date.now();
      const newVersion = existingBill.version + 1;
      
      db.prepare(`
        UPDATE bills SET 
          description = ?, 
          total_amount = ?, 
          payer_id = ?, 
          updated_at = ?,
          version = ?
        WHERE id = ?
      `).run(
        data.description.trim(),
        parseFloat(data.total_amount),
        data.payer_id,
        now,
        newVersion,
        id
      );
      
      db.prepare(`
        DELETE FROM bill_splits WHERE bill_id = ?
      `).run(id);
      
      const insertSplit = db.prepare(`
        INSERT INTO bill_splits (id, bill_id, user_id, amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const split of data.splits) {
        insertSplit.run(
          uuidv4(),
          id,
          split.user_id,
          parseFloat(split.amount),
          now
        );
      }
      
      const updatedBill = this.getBillById(id);
      
      logAudit(OPERATIONS.UPDATE, ENTITY_TYPES.BILL, id, existingBill, updatedBill, req);
      
      return updatedBill;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to update bill', { error: error.message, billId: id });
      throw error;
    }
  }

  static deleteBill(id, req = {}) {
    const transaction = db.transaction(() => {
      const existingBill = db.prepare(`
        SELECT * FROM bills WHERE id = ? AND is_deleted = 0
      `).get(id);
      
      if (!existingBill) {
        throw new Error('Bill not found');
      }
      
      const now = Date.now();
      
      db.prepare(`
        UPDATE bills SET 
          is_deleted = 1,
          updated_at = ?,
          version = version + 1
        WHERE id = ?
      `).run(now, id);
      
      logAudit(OPERATIONS.DELETE, ENTITY_TYPES.BILL, id, existingBill, null, req);
      
      return true;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to delete bill', { error: error.message, billId: id });
      throw error;
    }
  }

  static calculateBalance() {
    try {
      const users = db.prepare('SELECT * FROM users').all();
      
      if (users.length === 0) {
        return [];
      }
      const balances = {};
      
      for (const user of users) {
        balances[user.id] = {
          userId: user.id,
          userName: user.name,
          paid: 0,
          owed: 0,
          balance: 0
        };
      }
      
      const paidTotal = db.prepare(`
        SELECT payer_id, COALESCE(SUM(total_amount), 0) as total
        FROM bills
        WHERE is_deleted = 0
        GROUP BY payer_id
      `).all();
      
      for (const row of paidTotal) {
        if (balances[row.payer_id]) {
          balances[row.payer_id].paid = row.total;
        }
      }
      
      const owedTotal = db.prepare(`
        SELECT user_id, COALESCE(SUM(amount), 0) as total
        FROM bill_splits
        WHERE bill_id IN (SELECT id FROM bills WHERE is_deleted = 0)
        GROUP BY user_id
      `).all();
      
      for (const row of owedTotal) {
        if (balances[row.user_id]) {
          balances[row.user_id].owed = row.total;
        }
      }
      
      for (const userId in balances) {
        balances[userId].balance = balances[userId].paid - balances[userId].owed;
      }
      
      return Object.values(balances);
    } catch (error) {
      logger.error('Failed to calculate balance', { error: error.message });
      throw error;
    }
  }

  static calculateSettlement() {
    try {
      const balances = this.calculateBalance();
      
      const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: -b.balance }));
      const creditors = balances.filter(b => b.balance > 0);
      
      debtors.sort((a, b) => b.balance - a.balance);
      creditors.sort((a, b) => b.balance - a.balance);
      
      const settlements = [];
      let i = 0, j = 0;
      
      while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(debtor.balance, creditor.balance);
        
        if (amount > 0.01) {
          settlements.push({
            from: {
              userId: debtor.userId,
              userName: debtor.userName
            },
            to: {
              userId: creditor.userId,
              userName: creditor.userName
            },
            amount: parseFloat(amount.toFixed(2))
          });
        }
        
        debtor.balance -= amount;
        creditor.balance -= amount;
        
        if (debtor.balance < 0.01) i++;
        if (creditor.balance < 0.01) j++;
      }
      
      return {
        balances,
        settlements
      };
    } catch (error) {
      logger.error('Failed to calculate settlement', { error: error.message });
      throw error;
    }
  }

  static getBillsByDateRange(startDate, endDate) {
    try {
      let query = `SELECT * FROM bills WHERE is_deleted = 0`;
      const params = [];
      
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const bills = db.prepare(query).all(...params);
      
      return bills.map(bill => {
        const splits = db.prepare(`
          SELECT * FROM bill_splits WHERE bill_id = ?
        `).all(bill.id);
        
        return {
          ...bill,
          splits
        };
      });
    } catch (error) {
      logger.error('Failed to get bills by date range', { error: error.message });
      throw error;
    }
  }
}

module.exports = {
  BillService,
  CONCURRENCY_ERROR
};
