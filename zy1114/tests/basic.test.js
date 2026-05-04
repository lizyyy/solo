const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, '../data/test-rehearsal.db');

const db = require('../src/config/database');
const { initDatabase } = require('../src/config/schema');

const { BOOKING_STATES, canTransition, validateTransition, getStateDisplayName } = require('../src/services/bookingStateService');
const { calculateDurationHours, calculateRoomFee, calculateDeviceFee, calculateDepositRequired } = require('../src/services/pricingService');
const { ConflictError } = require('../src/utils/errors');

test.describe('基础测试', () => {
  test.before(() => {
    const testDbPath = path.join(__dirname, '../data/test-rehearsal.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    initDatabase();
  });
  
  test.describe('状态流转测试', () => {
    test('待确认 -> 已付押金 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.PENDING_CONFIRMATION, BOOKING_STATES.DEPOSIT_PAID));
    });
    
    test('待确认 -> 已取消 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.PENDING_CONFIRMATION, BOOKING_STATES.CANCELLED));
    });
    
    test('已付押金 -> 已到店 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.DEPOSIT_PAID, BOOKING_STATES.CHECKED_IN));
    });
    
    test('已到店 -> 使用中 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.CHECKED_IN, BOOKING_STATES.IN_USE));
    });
    
    test('使用中 -> 待结算 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.IN_USE, BOOKING_STATES.PENDING_SETTLEMENT));
    });
    
    test('待结算 -> 已结清 是有效流转', () => {
      assert.ok(canTransition(BOOKING_STATES.PENDING_SETTLEMENT, BOOKING_STATES.SETTLED));
    });
    
    test('已结清 -> 任何状态 都是无效流转', () => {
      assert.ok(!canTransition(BOOKING_STATES.SETTLED, BOOKING_STATES.IN_USE));
      assert.ok(!canTransition(BOOKING_STATES.SETTLED, BOOKING_STATES.CANCELLED));
    });
    
    test('状态显示名称正确', () => {
      assert.equal(getStateDisplayName(BOOKING_STATES.PENDING_CONFIRMATION), '待确认');
      assert.equal(getStateDisplayName(BOOKING_STATES.DEPOSIT_PAID), '已付押金');
      assert.equal(getStateDisplayName(BOOKING_STATES.CHECKED_IN), '已到店');
      assert.equal(getStateDisplayName(BOOKING_STATES.IN_USE), '使用中');
      assert.equal(getStateDisplayName(BOOKING_STATES.PENDING_SETTLEMENT), '待结算');
      assert.equal(getStateDisplayName(BOOKING_STATES.SETTLED), '已结清');
      assert.equal(getStateDisplayName(BOOKING_STATES.CANCELLED), '已取消');
    });
  });
  
  test.describe('费用计算测试', () => {
    test('计算时长 - 30分钟计为0.5小时', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const duration = calculateDurationHours(startTime.toISOString(), endTime.toISOString());
      assert.equal(duration, 0.5);
    });
    
    test('计算时长 - 65分钟计为1.5小时（向上取整到0.5小时）', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T11:05:00Z');
      const duration = calculateDurationHours(startTime.toISOString(), endTime.toISOString());
      assert.equal(duration, 1.5);
    });
    
    test('结束时间早于开始时间抛出错误', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T09:00:00Z');
      assert.throws(() => {
        calculateDurationHours(startTime.toISOString(), endTime.toISOString());
      });
    });
  });
  
  test.describe('数据库操作测试', () => {
    test('可以插入和查询房间', () => {
      const insertStmt = db.prepare(`
        INSERT INTO rooms (name, type, capacity, base_rate_per_hour, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = insertStmt.run('测试房间', 'rehearsal', 5, 100, 'active');
      
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
      
      assert.equal(room.name, '测试房间');
      assert.equal(room.type, 'rehearsal');
      assert.equal(room.capacity, 5);
      assert.equal(room.base_rate_per_hour, 100);
    });
    
    test('可以插入和查询客户', () => {
      const insertStmt = db.prepare(`
        INSERT INTO customers (name, phone, email)
        VALUES (?, ?, ?)
      `);
      const result = insertStmt.run('测试客户', '13800138000', 'test@example.com');
      
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
      
      assert.equal(customer.name, '测试客户');
      assert.equal(customer.phone, '13800138000');
      assert.equal(customer.email, 'test@example.com');
    });
    
    test('可以插入和查询设备', () => {
      const insertStmt = db.prepare(`
        INSERT INTO devices (name, category, rental_rate_per_hour, deposit_required, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = insertStmt.run('测试话筒', 'microphone', 20, 500, 'available');
      
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
      
      assert.equal(device.name, '测试话筒');
      assert.equal(device.category, 'microphone');
      assert.equal(device.rental_rate_per_hour, 20);
      assert.equal(device.deposit_required, 500);
    });
  });
  
  test.after(() => {
    db.close();
    const testDbPath = path.join(__dirname, '../data/test-rehearsal.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
});
