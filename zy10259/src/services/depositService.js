const db = require('../models/database');
const OrderService = require('./orderService');
const { generateTransactionNo, generateBillNo } = require('../utils/helpers');

class DepositService {
  static async recordPayment(data) {
    const { order_id, amount, operator, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          if (order.deposit_paid) {
            throw new Error('押金已支付，请勿重复操作');
          }
          
          const existingTransactions = await this.getTransactionsByOrderId(order_id);
          const totalPaid = existingTransactions.reduce((sum, t) => 
            t.transaction_type === 'payment' ? sum + t.amount : sum - t.amount, 0);
          
          const newBalance = totalPaid + amount;
          const transactionNo = generateTransactionNo();
          
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO deposit_transactions 
               (transaction_no, order_id, transaction_type, amount, balance, operator, reason)
               VALUES (?, ?, 'payment', ?, ?, ?, ?)`,
              [transactionNo, order_id, amount, newBalance, operator, remarks || '押金支付'],
              (err) => err ? rej(err) : res()
            );
          });
          
          if (newBalance >= order.deposit_amount) {
            await new Promise((res, rej) => {
              db.run(
                'UPDATE rental_orders SET deposit_paid = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [order_id],
                (err) => err ? rej(err) : res()
              );
            });
          }
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const transaction = await this.getTransactionById(transactionNo);
          resolve(transaction);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async deductDeposit(data) {
    const { order_id, amount, operator, reason } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          const existingTransactions = await this.getTransactionsByOrderId(order_id);
          const availableBalance = existingTransactions.reduce((sum, t) => 
            t.transaction_type === 'payment' ? sum + t.amount : sum - t.amount, 0);
          
          if (availableBalance < amount) {
            throw new Error('押金余额不足');
          }
          
          const newBalance = availableBalance - amount;
          const transactionNo = generateTransactionNo();
          
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO deposit_transactions 
               (transaction_no, order_id, transaction_type, amount, balance, operator, reason)
               VALUES (?, ?, 'deduction', ?, ?, ?, ?)`,
              [transactionNo, order_id, amount, newBalance, operator, reason || '押金扣减'],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE rental_orders SET deposit_deducted = deposit_deducted + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [amount, order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          const billNo = generateBillNo();
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO bills (bill_no, order_id, bill_type, amount, status, remarks)
               VALUES (?, ?, 'damage', ?, 'paid', ?)`,
              [billNo, order_id, amount, reason || '损坏赔偿（押金扣减）'],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const transaction = await this.getTransactionById(transactionNo);
          resolve(transaction);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async refundDeposit(data) {
    const { order_id, amount, operator, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          const existingTransactions = await this.getTransactionsByOrderId(order_id);
          const availableBalance = existingTransactions.reduce((sum, t) => 
            t.transaction_type === 'payment' ? sum + t.amount : sum - t.amount, 0);
          
          if (availableBalance < amount) {
            throw new Error('押金余额不足');
          }
          
          const newBalance = availableBalance - amount;
          const transactionNo = generateTransactionNo();
          
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO deposit_transactions 
               (transaction_no, order_id, transaction_type, amount, balance, operator, reason)
               VALUES (?, ?, 'refund', ?, ?, ?, ?)`,
              [transactionNo, order_id, amount, newBalance, operator, remarks || '押金退还'],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const transaction = await this.getTransactionById(transactionNo);
          resolve(transaction);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getTransactionById(transactionNo) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM deposit_transactions WHERE transaction_no = ?', [transactionNo], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getTransactionsByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM deposit_transactions WHERE order_id = ? ORDER BY created_at', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = DepositService;
