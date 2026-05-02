import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, initDatabase, closeDatabase } from '../database.js';
import { StateMachine, CASE_STATES, CASE_STATE_TRANSITIONS } from '../state-machine.js';
import { RuleEngine } from '../rule-engine.js';
import { v4 as uuidv4 } from 'uuid';

describe('StateMachine', () => {
  let db;
  let stateMachine;

  beforeEach(() => {
    db = getDatabase();
    initDatabase();
    stateMachine = new StateMachine(db);
  });

  afterEach(() => {
    db.exec('DELETE FROM cases');
    db.exec('DELETE FROM version_history');
  });

  it('should validate valid state transition', () => {
    const valid = stateMachine.canTransition(
      CASE_STATES.PRESCRIPTION_RECEIVED,
      CASE_STATES.SCAN_RECEIVED
    );
    assert.equal(valid, true);
  });

  it('should reject invalid state transition', () => {
    const valid = stateMachine.canTransition(
      CASE_STATES.PRESCRIPTION_RECEIVED,
      CASE_STATES.COMPLETED
    );
    assert.equal(valid, false);
  });

  it('should return available next states', () => {
    const nextStates = stateMachine.getAvailableNextStates(CASE_STATES.PRESCRIPTION_RECEIVED);
    assert.deepEqual(nextStates, [CASE_STATES.SCAN_RECEIVED]);
  });

  it('should return correct state description', () => {
    const desc = stateMachine.getStateDescription(CASE_STATES.DESIGNING);
    assert.equal(desc, '设计中');
  });

  it('should transition case state and create version history', () => {
    const caseId = uuidv4();
    db.prepare(`
      INSERT INTO cases (id, case_number, patient_name, status)
      VALUES (?, ?, ?, ?)
    `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.PRESCRIPTION_RECEIVED);

    const result = stateMachine.transitionState(
      caseId,
      CASE_STATES.SCAN_RECEIVED,
      'test-operator',
      '测试转换'
    );

    assert.equal(result.previousStatus, CASE_STATES.PRESCRIPTION_RECEIVED);
    assert.equal(result.newStatus, CASE_STATES.SCAN_RECEIVED);

    const updatedCase = db.prepare('SELECT status FROM cases WHERE id = ?').get(caseId);
    assert.equal(updatedCase.status, CASE_STATES.SCAN_RECEIVED);

    const history = stateMachine.getStateHistory(caseId);
    assert.equal(history.length, 1);
    assert.equal(history[0].action, 'STATE_TRANSITION');
  });

  it('should throw error for invalid transition in database', () => {
    const caseId = uuidv4();
    db.prepare(`
      INSERT INTO cases (id, case_number, patient_name, status)
      VALUES (?, ?, ?, ?)
    `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.PRESCRIPTION_RECEIVED);

    assert.throws(() => {
      stateMachine.transitionState(
        caseId,
        CASE_STATES.COMPLETED,
        'test-operator',
        '无效转换'
      );
    }, /Invalid state transition/);
  });
});

describe('RuleEngine', () => {
  let db;
  let ruleEngine;

  beforeEach(() => {
    db = getDatabase();
    initDatabase();
    ruleEngine = new RuleEngine(db);
  });

  afterEach(() => {
    db.exec('DELETE FROM cases');
    db.exec('DELETE FROM teeth');
    db.exec('DELETE FROM prescriptions');
    db.exec('DELETE FROM scan_files');
    db.exec('DELETE FROM rework_requests');
    db.exec('DELETE FROM try_in_feedbacks');
  });

  describe('validatePrescriptionScanLink', () => {
    it('should return error for case without prescription', () => {
      const caseId = uuidv4();
      db.prepare(`
        INSERT INTO cases (id, case_number, patient_name, status)
        VALUES (?, ?, ?, ?)
      `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.PRESCRIPTION_RECEIVED);

      const violations = ruleEngine.validatePrescriptionScanLink(caseId);
      
      assert.equal(violations.length, 1);
      assert.equal(violations[0].type, 'MISSING_PRESCRIPTION');
    });

    it('should return warning for teeth mismatch', () => {
      const caseId = uuidv4();
      db.prepare(`
        INSERT INTO cases (id, case_number, patient_name, status)
        VALUES (?, ?, ?, ?)
      `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.PRESCRIPTION_RECEIVED);

      db.prepare(`
        INSERT INTO prescriptions (id, case_id, prescription_number, received_at, tooth_numbers)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(uuidv4(), caseId, 'RX-001', '15,16,17');

      db.prepare(`
        INSERT INTO scan_files (id, case_id, file_name, file_type, scan_type, is_valid)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(uuidv4(), caseId, 'scan.stl', 'stl', 'MASTER');

      db.prepare(`
        INSERT INTO teeth (id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status)
        VALUES (?, ?, ?, ?, 0, 0, 1, 'PENDING')
      `).run(uuidv4(), caseId, 15, 'CROWN');

      const violations = ruleEngine.validatePrescriptionScanLink(caseId);
      
      const mismatchViolation = violations.find(v => v.type === 'TEETH_MISMATCH');
      assert.ok(mismatchViolation);
    });
  });

  describe('checkDuplicateRework', () => {
    it('should return warning for pending rework', () => {
      const caseId = uuidv4();
      const toothId = uuidv4();

      db.prepare(`
        INSERT INTO cases (id, case_number, patient_name, status)
        VALUES (?, ?, ?, ?)
      `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.MANUFACTURING);

      db.prepare(`
        INSERT INTO teeth (id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status)
        VALUES (?, ?, ?, ?, 0, 0, 1, 'PENDING')
      `).run(toothId, caseId, 16, 'CROWN');

      db.prepare(`
        INSERT INTO rework_requests (
          id, case_id, tooth_id, request_date, reason_code,
          reason_description, rework_type, source_step, target_step, status
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), caseId, toothId,
        'FIT_ISSUE', '就位问题', 'MANUFACTURING',
        'QUALITY_INSPECTION', 'DIGITAL_DESIGN', 'PENDING'
      );

      const violations = ruleEngine.checkDuplicateRework(toothId);
      
      const pendingViolation = violations.find(v => v.type === 'PENDING_REWORK_EXISTS');
      assert.ok(pendingViolation);
    });

    it('should return error for in-progress rework', () => {
      const caseId = uuidv4();
      const toothId = uuidv4();

      db.prepare(`
        INSERT INTO cases (id, case_number, patient_name, status)
        VALUES (?, ?, ?, ?)
      `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.MANUFACTURING);

      db.prepare(`
        INSERT INTO teeth (id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status)
        VALUES (?, ?, ?, ?, 0, 0, 1, 'PENDING')
      `).run(toothId, caseId, 16, 'CROWN');

      db.prepare(`
        INSERT INTO rework_requests (
          id, case_id, tooth_id, request_date, reason_code,
          reason_description, rework_type, source_step, target_step, status
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), caseId, toothId,
        'FIT_ISSUE', '就位问题', 'MANUFACTURING',
        'QUALITY_INSPECTION', 'DIGITAL_DESIGN', 'APPROVED'
      );

      const violations = ruleEngine.checkDuplicateRework(toothId);
      
      const inProgressViolation = violations.find(v => v.type === 'REWORK_IN_PROGRESS');
      assert.ok(inProgressViolation);
    });

    it('should return critical warning for excessive rework', () => {
      const caseId = uuidv4();
      const toothId = uuidv4();

      db.prepare(`
        INSERT INTO cases (id, case_number, patient_name, status)
        VALUES (?, ?, ?, ?)
      `).run(caseId, 'TEST-001', 'Test Patient', CASE_STATES.MANUFACTURING);

      db.prepare(`
        INSERT INTO teeth (id, case_id, tooth_number, tooth_type, is_rework, rework_count, version, status)
        VALUES (?, ?, ?, ?, 1, 3, 4, 'REWORK_IN_PROGRESS')
      `).run(toothId, caseId, 16, 'CROWN');

      const violations = ruleEngine.checkDuplicateRework(toothId);
      
      const excessiveViolation = violations.find(v => v.type === 'EXCESSIVE_REWORK');
      assert.ok(excessiveViolation);
      assert.equal(excessiveViolation.severity, 'CRITICAL');
    });
  });

  describe('parseToothNumbers', () => {
    it('should parse single tooth numbers', () => {
      const result = ruleEngine.parseToothNumbers('15,16,17');
      assert.deepEqual(result, [15, 16, 17]);
    });

    it('should parse tooth number ranges', () => {
      const result = ruleEngine.parseToothNumbers('14-17');
      assert.deepEqual(result, [14, 15, 16, 17]);
    });

    it('should parse mixed format', () => {
      const result = ruleEngine.parseToothNumbers('11,12,14-16');
      assert.deepEqual(result, [11, 12, 14, 15, 16]);
    });

    it('should handle spaces', () => {
      const result = ruleEngine.parseToothNumbers('15, 16, 17');
      assert.deepEqual(result, [15, 16, 17]);
    });

    it('should filter out invalid numbers', () => {
      const result = ruleEngine.parseToothNumbers('0, 33, 16');
      assert.deepEqual(result, [16]);
    });
  });
});

describe('ImportExportService', () => {
  let db;

  beforeEach(() => {
    db = getDatabase();
    initDatabase();
  });

  afterEach(() => {
    db.exec('DELETE FROM cases');
  });

  it('should get entity display names', () => {
    const { ImportExportService } = await import('../import-export.js');
    const service = new ImportExportService(db);
    
    assert.equal(service.getEntityDisplayName('cases'), '病例列表');
    assert.equal(service.getEntityDisplayName('teeth'), '牙位信息');
    assert.equal(service.getEntityDisplayName('rework_requests'), '返工申请');
  });

  it('should get columns for entities', () => {
    const { ImportExportService } = await import('../import-export.js');
    const service = new ImportExportService(db);
    
    const caseColumns = service.getColumnsForEntity('cases');
    assert.ok(caseColumns.length > 0);
    assert.ok(caseColumns.find(c => c.key === 'case_number'));
    assert.ok(caseColumns.find(c => c.key === 'patient_name'));
  });
});
