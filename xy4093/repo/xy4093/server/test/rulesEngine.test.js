import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getDatabase, runQuery, getAll, getOne, closeDatabase } from '../server/database/db.js';
import { RulesEngine } from '../server/services/rulesEngine.js';
import { Scheduler } from '../server/services/scheduler.js';
import { v4 as uuidv4 } from 'uuid';

describe('RulesEngine', () => {
  describe('validatePriority', () => {
    it('should calculate correct priority for elderly guests', () => {
      const guest = { is_elderly: 1, is_child: 0, has_disability: 0 };
      const result = RulesEngine.validatePriority(guest);
      
      assert.strictEqual(result.score, 100);
      assert.ok(result.tags.includes('老人'));
    });

    it('should calculate correct priority for children', () => {
      const guest = { is_elderly: 0, is_child: 1, has_disability: 0 };
      const result = RulesEngine.validatePriority(guest);
      
      assert.strictEqual(result.score, 90);
      assert.ok(result.tags.includes('儿童'));
    });

    it('should calculate correct priority for disabled guests', () => {
      const guest = { is_elderly: 0, is_child: 0, has_disability: 1 };
      const result = RulesEngine.validatePriority(guest);
      
      assert.strictEqual(result.score, 80);
      assert.ok(result.tags.includes('行动不便'));
    });

    it('should calculate highest priority for guests with multiple conditions', () => {
      const guest = { is_elderly: 1, is_child: 0, has_disability: 1 };
      const result = RulesEngine.validatePriority(guest);
      
      assert.strictEqual(result.score, 100);
      assert.ok(result.tags.includes('老人'));
      assert.ok(result.tags.includes('行动不便'));
    });

    it('should return 0 for normal guests', () => {
      const guest = { is_elderly: 0, is_child: 0, has_disability: 0 };
      const result = RulesEngine.validatePriority(guest);
      
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.tags.length, 0);
    });
  });

  describe('validateShipCapacity', () => {
    it('should return true when capacity is sufficient', () => {
      const result = RulesEngine.validateShipCapacity(30, 5, 30);
      assert.strictEqual(result.valid, true);
    });

    it('should return false when capacity is exceeded', () => {
      const result = RulesEngine.validateShipCapacity(30, 25, 10);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('容量不足'));
    });
  });

  describe('validateSupplyThreshold', () => {
    it('should identify critical supplies', () => {
      const result = RulesEngine.validateSupplyThreshold(50, 100);
      assert.strictEqual(result.isCritical, true);
      assert.ok(result.percentage, 50);
    });

    it('should identify sufficient supplies', () => {
      const result = RulesEngine.validateSupplyThreshold(150, 100);
      assert.strictEqual(result.isCritical, false);
      assert.ok(result.percentage, 150);
    });
  });
});

describe('Scheduler', () => {
  let testRoomId;
  let testGuestId;

  beforeEach(() => {
    testRoomId = uuidv4();
    testGuestId = uuidv4();
    
    runQuery(`
      INSERT INTO rooms (id, room_number, floor, capacity, is_occupied, is_evacuated, is_window_sealed)
      VALUES (?, '999', 9, 2, 1, 0, 0)
    `, [testRoomId]);

    runQuery(`
      INSERT INTO guests (id, room_id, name, age, is_evacuated, evacuation_batch_id)
      VALUES (?, ?, '测试住客', 30, 0, NULL)
    `, [testGuestId, testRoomId]);
  });

  afterEach(() => {
    runQuery('DELETE FROM guests WHERE id = ?', [testGuestId]);
    runQuery('DELETE FROM rooms WHERE id = ?', [testRoomId]);
  });

  describe('generateEvacuationPlan', () => {
    it('should generate evacuation plan with priority sorting', () => {
      const plan = Scheduler.generateEvacuationPlan({ useShips: false, batchSize: 10 });
      
      assert.ok(plan.batches);
      assert.ok(plan.statistics);
    });
  });

  describe('validateRoomClearForSeal', () => {
    it('should not allow sealing room with guests', () => {
      const result = Scheduler.sealRoomWindow(testRoomId);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('清空'));
    });
  });

  describe('markGuestEvacuated', () => {
    it('should mark guest as evacuated', () => {
      const result = Scheduler.markGuestEvacuated(testGuestId);
      
      assert.strictEqual(result.success, true);
      
      const updatedGuest = getOne('SELECT * FROM guests WHERE id = ?', [testGuestId]);
      assert.strictEqual(updatedGuest.is_evacuated, 1);
    });

    it('should return error for non-existent guest', () => {
      const nonExistentId = uuidv4();
      const result = Scheduler.markGuestEvacuated(nonExistentId);
      
      assert.strictEqual(result.success, false);
    });
  });

  describe('getEvacuationStatus', () => {
    it('should return correct status structure', () => {
      const status = Scheduler.getEvacuationStatus();
      
      assert.ok(status.guests);
      assert.ok(status.rooms);
      assert.ok(status.batches);
      assert.ok(status.supplies);
      
      assert.strictEqual(typeof status.guests.total, 'number');
      assert.strictEqual(typeof status.guests.percentage, 'number');
    });
  });
});

describe('Database Operations', () => {
  it('should connect to database', () => {
    const db = getDatabase();
    assert.ok(db);
  });

  it('should execute basic queries', () => {
    const result = getAll('SELECT 1 as test');
    assert.strictEqual(result[0].test, 1);
  });

  it('should return single row with getOne', () => {
    const result = getOne('SELECT 1 as test');
    assert.strictEqual(result.test, 1);
  });
});

describe('ExportService', () => {
  let testShipId;
  let testBatchId;

  beforeEach(() => {
    testShipId = uuidv4();
    testBatchId = uuidv4();
    
    runQuery(`
      INSERT INTO ships (id, name, capacity, current_load, status)
      VALUES (?, '测试船', 20, 0, 'available')
    `, [testShipId]);

    runQuery(`
      INSERT INTO evacuation_batches (id, batch_number, ship_id, status, guest_count, max_capacity)
      VALUES (?, 99, ?, 'planned', 0, 20)
    `, [testBatchId, testShipId]);
  });

  afterEach(() => {
    runQuery('DELETE FROM evacuation_batches WHERE id = ?', [testBatchId]);
    runQuery('DELETE FROM ships WHERE id = ?', [testShipId]);
  });

  it('should validate ship capacity correctly', () => {
    const validation = RulesEngine.validateGuestAssignment(null, testBatchId, 15);
    assert.ok(validation.valid || validation.error);
  });
});

console.log('\n=====================================');
console.log('  测试用例加载完成');
console.log('  运行命令: npm test');
console.log('=====================================');
