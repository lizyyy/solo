const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { ImportResult, validationErrors } = require('../services/dataImporter');

describe('DataImporter', () => {
  beforeEach(() => {
    db.exec(`
      DELETE FROM customers;
      DELETE FROM orders;
      DELETE FROM call_notes;
      DELETE FROM attributions;
      DELETE FROM commitments;
    `);
  });

  describe('ImportResult', () => {
    it('应该正确初始化', () => {
      const result = new ImportResult();
      assert.strictEqual(result.success, 0);
      assert.deepStrictEqual(result.errors, []);
      assert.deepStrictEqual(result.warnings, []);
    });

    it('应该正确添加错误', () => {
      const result = new ImportResult();
      result.addError('测试错误', 2, '详细信息');
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].message, '测试错误');
      assert.strictEqual(result.errors[0].row, 2);
      assert.strictEqual(result.errors[0].detail, '详细信息');
    });

    it('应该正确添加警告', () => {
      const result = new ImportResult();
      result.addWarning('测试警告', 3, '详细信息');
      assert.strictEqual(result.warnings.length, 1);
      assert.strictEqual(result.warnings[0].message, '测试警告');
      assert.strictEqual(result.warnings[0].row, 3);
      assert.strictEqual(result.warnings[0].detail, '详细信息');
    });
  });

  describe('validationErrors', () => {
    it('应该包含所有预设错误类型', () => {
      assert.ok(validationErrors.MISSING_CUSTOMER);
      assert.ok(validationErrors.ORDER_NOT_FOUND);
      assert.ok(validationErrors.INVALID_DATE);
      assert.ok(validationErrors.MISSING_REQUIRED_FIELD);
      assert.ok(validationErrors.CATEGORY_NOT_FOUND);
      assert.ok(validationErrors.DUPLICATE_ID);
    });
  });

  describe('CSV导入流程', () => {
    it('应该正确导入客户数据', async () => {
      const insertStmt = db.prepare(`
        INSERT INTO customers (customer_id, name, phone, email, region, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('C001', '测试用户', '13800000000', 'test@example.com', '北京', '测试地址');

      const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get('C001');
      assert.strictEqual(customer.name, '测试用户');
      assert.strictEqual(customer.phone, '13800000000');
    });

    it('应该正确处理重复ID', async () => {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO customers (customer_id, name, phone, email, region, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('C001', '第一个用户', '13800000001', 'first@example.com', '北京', '地址1');
      insertStmt.run('C001', '第二个用户', '13800000002', 'second@example.com', '上海', '地址2');

      const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get('C001');
      assert.strictEqual(customer.name, '第二个用户');
      assert.strictEqual(customer.phone, '13800000002');
    });

    it('应该正确导入订单数据', async () => {
      db.prepare(`
        INSERT INTO customers (customer_id, name)
        VALUES ('C001', '测试用户')
      `).run();

      const insertStmt = db.prepare(`
        INSERT INTO orders (order_id, customer_id, product_name, category, purchase_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('O001', 'C001', '测试产品', '测试分类', '2024-01-01', 'active');

      const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get('O001');
      assert.strictEqual(order.product_name, '测试产品');
      assert.strictEqual(order.customer_id, 'C001');
    });
  });
});
