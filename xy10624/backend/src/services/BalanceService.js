const db = require('../database/init');
const OperationLogService = require('./OperationLogService');

class BalanceService {
  static calculateBalance(customerAddressId) {
    const address = db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(customerAddressId);
    if (!address) {
      throw new Error('客户地址不存在');
    }

    const borrowedResult = db.prepare(`
      SELECT COUNT(*) as count, SUM(bucket_count) as total
      FROM delivery_signoffs 
      WHERE customer_address_id = ? AND status = 'confirmed'
    `).get(customerAddressId);

    const returnedResult = db.prepare(`
      SELECT COUNT(*) as count, SUM(bucket_count) as total
      FROM bucket_returns 
      WHERE customer_address_id = ? AND status IN ('accepted', 'completed')
    `).get(customerAddressId);

    const damagedResult = db.prepare(`
      SELECT COUNT(*) as count, SUM(compensation_amount) as amount
      FROM damage_seizures 
      WHERE return_no IN (
        SELECT return_no FROM bucket_returns WHERE customer_address_id = ?
      ) AND status = 'confirmed'
    `).get(customerAddressId);

    const seizedResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM damage_seizures 
      WHERE return_no IN (
        SELECT return_no FROM bucket_returns WHERE customer_address_id = ?
      ) AND status = 'confirmed'
    `).get(customerAddressId);

    const totalBorrowed = borrowedResult.total || 0;
    const totalReturned = returnedResult.total || 0;
    const totalDamaged = damagedResult.count || 0;
    const totalSeized = seizedResult.count || 0;
    const outstandingBalance = totalBorrowed - totalReturned - totalDamaged;
    const bucketPrice = 50;
    const balanceAmount = outstandingBalance * bucketPrice;

    return {
      customerAddressId,
      customerName: address.customer_name,
      customerId: address.customer_id,
      totalBorrowed,
      totalReturned,
      totalDamaged,
      totalSeized,
      outstandingBalance,
      balanceAmount,
      bucketPrice
    };
  }

  static getBalance(customerAddressId) {
    let balance = db.prepare('SELECT * FROM bucket_balances WHERE customer_address_id = ?').get(customerAddressId);
    const calculated = this.calculateBalance(customerAddressId);

    if (balance) {
      const beforeValues = { ...balance };
      db.prepare(`
        UPDATE bucket_balances 
        SET total_borrowed = ?, total_returned = ?, total_damaged = ?, 
            total_seized = ?, outstanding_balance = ?, balance_amount = ?,
            last_calculated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE customer_address_id = ?
      `).run(
        calculated.totalBorrowed,
        calculated.totalReturned,
        calculated.totalDamaged,
        calculated.totalSeized,
        calculated.outstandingBalance,
        calculated.balanceAmount,
        customerAddressId
      );

      OperationLogService.log(
        'UPDATE',
        'bucket_balances',
        balance.id,
        null,
        beforeValues,
        calculated,
        'system',
        '系统',
        '更新欠桶余额'
      );
    } else {
      const result = db.prepare(`
        INSERT INTO bucket_balances 
        (customer_address_id, total_borrowed, total_returned, total_damaged, 
         total_seized, outstanding_balance, balance_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerAddressId,
        calculated.totalBorrowed,
        calculated.totalReturned,
        calculated.totalDamaged,
        calculated.totalSeized,
        calculated.outstandingBalance,
        calculated.balanceAmount
      );

      OperationLogService.log(
        'CREATE',
        'bucket_balances',
        result.lastInsertRowid,
        null,
        null,
        calculated,
        'system',
        '系统',
        '创建欠桶余额'
      );
    }

    return calculated;
  }

  static getAllBalances(filters = {}) {
    const addresses = db.prepare('SELECT id FROM customer_addresses WHERE is_active = 1').all();
    return addresses.map(addr => this.getBalance(addr.id));
  }
}

module.exports = BalanceService;
