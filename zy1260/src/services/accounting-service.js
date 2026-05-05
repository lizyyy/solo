const db = require('../config/database');

const AccountingService = {
  getAccount: (accountId) => {
    return db.prepare(`
      SELECT * FROM accounts WHERE account_id = ?
    `).get(accountId);
  },

  prepare: (transactionId, accountId, amount) => {
    const account = db.prepare(`
      SELECT * FROM accounts WHERE account_id = ?
    `).get(accountId);

    if (!account) {
      throw new Error(`账户不存在: ${accountId}`);
    }

    const availableBalance = account.balance - account.frozen_balance;
    if (availableBalance < amount) {
      throw new Error(`账户余额不足，可用余额: ${availableBalance}, 冻结需求: ${amount}`);
    }

    db.prepare(`
      UPDATE accounts SET frozen_balance = frozen_balance + ? WHERE account_id = ?
    `).run(amount, accountId);

    db.prepare(`
      INSERT INTO account_operations (transaction_id, account_id, amount, operation_type, status)
      VALUES (?, ?, ?, 'PREPARE', 'SUCCESS')
    `).run(transactionId, accountId, amount);

    return {
      success: true,
      accountId,
      amount,
      action: 'PREPARE',
      message: `冻结账户 ${accountId} 金额 ${amount}`
    };
  },

  confirm: (transactionId, fromAccountId, toAccountId, amount) => {
    db.prepare(`
      UPDATE accounts 
      SET balance = balance - ?, 
          frozen_balance = frozen_balance - ?
      WHERE account_id = ?
    `).run(amount, amount, fromAccountId);

    db.prepare(`
      UPDATE accounts SET balance = balance + ? WHERE account_id = ?
    `).run(amount, toAccountId);

    db.prepare(`
      INSERT INTO account_operations (transaction_id, account_id, amount, operation_type, status)
      VALUES (?, ?, ?, 'CONFIRM', 'SUCCESS')
    `).run(transactionId, fromAccountId, -amount);

    db.prepare(`
      INSERT INTO account_operations (transaction_id, account_id, amount, operation_type, status)
      VALUES (?, ?, ?, 'CONFIRM', 'SUCCESS')
    `).run(transactionId, toAccountId, amount);

    return {
      success: true,
      fromAccountId,
      toAccountId,
      amount,
      action: 'CONFIRM',
      message: `确认转账 ${amount} 从 ${fromAccountId} 到 ${toAccountId}`
    };
  },

  cancel: (transactionId, accountId, amount) => {
    db.prepare(`
      UPDATE accounts SET frozen_balance = frozen_balance - ? WHERE account_id = ?
    `).run(amount, accountId);

    db.prepare(`
      INSERT INTO account_operations (transaction_id, account_id, amount, operation_type, status)
      VALUES (?, ?, ?, 'CANCEL', 'SUCCESS')
    `).run(transactionId, accountId, amount);

    return {
      success: true,
      accountId,
      amount,
      action: 'CANCEL',
      message: `取消冻结，归还账户 ${accountId} 金额 ${amount}`
    };
  },

  getOperationHistory: (transactionId) => {
    return db.prepare(`
      SELECT * FROM account_operations WHERE transaction_id = ? ORDER BY created_at ASC
    `).all(transactionId);
  },

  listAllAccounts: () => {
    return db.prepare('SELECT * FROM accounts ORDER BY account_id').all();
  }
};

module.exports = AccountingService;
