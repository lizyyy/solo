const moment = require('moment');
const models = require('../../models');
const { STATES } = require('../../models/stateMachine');

describe('Box Model', () => {
  test('should create a box with default values', () => {
    const box = new models.Box();
    expect(box.id).toBeDefined();
    expect(box.currentState).toBe(STATES.BOX.IDLE);
  });

  test('should create a box with custom values', () => {
    const box = new models.Box({
      name: '保温箱-001',
      serialNumber: 'BOX-2026-001',
      capacity: 50
    });
    expect(box.name).toBe('保温箱-001');
    expect(box.serialNumber).toBe('BOX-2026-001');
    expect(box.capacity).toBe(50);
  });

  test('should assign and release batch', () => {
    const box = new models.Box();
    const batchId = 'batch-123';
    
    box.assignBatch(batchId);
    expect(box.currentBatchId).toBe(batchId);
    
    box.releaseBatch();
    expect(box.currentBatchId).toBeNull();
  });

  test('should not assign batch if already assigned', () => {
    const box = new models.Box();
    box.assignBatch('batch-1');
    
    expect(() => box.assignBatch('batch-2')).toThrow();
  });

  test('should transition between states', () => {
    const box = new models.Box();
    expect(box.currentState).toBe(STATES.BOX.IDLE);
    
    box.transitionTo(STATES.BOX.IN_TRANSIT, '开始运输');
    expect(box.currentState).toBe(STATES.BOX.IN_TRANSIT);
    
    box.transitionTo(STATES.BOX.AT_STATION, '到达站点');
    expect(box.currentState).toBe(STATES.BOX.AT_STATION);
  });

  test('should throw error for invalid transition', () => {
    const box = new models.Box();
    expect(box.currentState).toBe(STATES.BOX.IDLE);
    
    expect(() => box.transitionTo(STATES.BOX.COMPLETED, '直接完成')).toThrow();
  });

  test('should serialize to JSON', () => {
    const box = new models.Box({
      name: '保温箱-001',
      serialNumber: 'BOX-2026-001'
    });
    
    const json = box.toJSON();
    expect(json.name).toBe('保温箱-001');
    expect(json.currentState).toBe(STATES.BOX.IDLE);
    expect(json.createdAt).toBeDefined();
  });

  test('should deserialize from JSON', () => {
    const original = new models.Box({
      name: '保温箱-001',
      serialNumber: 'BOX-2026-001'
    });
    original.transitionTo(STATES.BOX.IN_TRANSIT, '测试');
    
    const json = original.toJSON();
    const restored = models.Box.fromJSON(json);
    
    expect(restored.name).toBe(original.name);
    expect(restored.currentState).toBe(original.currentState);
  });
});

describe('Batch Model', () => {
  test('should create a batch with default values', () => {
    const batch = new models.Batch();
    expect(batch.id).toBeDefined();
    expect(batch.currentState).toBe(STATES.BATCH.PENDING);
    expect(batch.hasAnyRisk()).toBe(false);
  });

  test('should create a batch with custom values', () => {
    const batch = new models.Batch({
      batchNumber: 'VAC-2026-001',
      vaccineName: '甲型流感疫苗',
      quantity: 100
    });
    expect(batch.batchNumber).toBe('VAC-2026-001');
    expect(batch.vaccineName).toBe('甲型流感疫苗');
    expect(batch.quantity).toBe(100);
  });

  test('should calculate delay minutes', () => {
    const now = moment();
    const batch = new models.Batch({
      scheduledArrivalTime: now.clone().subtract(30, 'minutes').toISOString(),
      actualArrivalTime: now.toISOString()
    });
    
    expect(batch.getDelayMinutes()).toBe(30);
  });

  test('should check if delayed', () => {
    const now = moment();
    const batch = new models.Batch({
      scheduledArrivalTime: now.clone().subtract(30, 'minutes').toISOString(),
      actualArrivalTime: now.toISOString()
    });
    
    expect(batch.isDelayed(15)).toBe(true);
    expect(batch.isDelayed(45)).toBe(false);
  });

  test('should set and check risk flags', () => {
    const batch = new models.Batch();
    expect(batch.hasAnyRisk()).toBe(false);
    
    batch.setRiskFlag('temperatureViolation', true);
    expect(batch.riskFlags.temperatureViolation).toBe(true);
    expect(batch.hasAnyRisk()).toBe(true);
    
    batch.setRiskFlag('temperatureViolation', false);
    expect(batch.riskFlags.temperatureViolation).toBe(false);
  });
});

describe('HandoverForm Model', () => {
  test('should create a handover form with default values', () => {
    const form = new models.HandoverForm();
    expect(form.id).toBeDefined();
    expect(form.currentState).toBe(STATES.HANDOVER.PENDING);
    expect(form.hasCompleteSignatures()).toBe(false);
  });

  test('should sign sender and receiver', () => {
    const form = new models.HandoverForm();
    
    expect(form.isSenderSigned()).toBe(false);
    expect(form.isReceiverSigned()).toBe(false);
    
    form.signSender('sig-sender-1', 'person-1');
    expect(form.isSenderSigned()).toBe(true);
    expect(form.hasCompleteSignatures()).toBe(false);
    
    form.signReceiver('sig-receiver-1', 'person-2');
    expect(form.isReceiverSigned()).toBe(true);
    expect(form.hasCompleteSignatures()).toBe(true);
  });

  test('should get missing signatures', () => {
    const form = new models.HandoverForm();
    
    let missing = form.getMissingSignatures();
    expect(missing).toContain('sender');
    expect(missing).toContain('receiver');
    
    form.signSender('sig-sender-1');
    missing = form.getMissingSignatures();
    expect(missing).not.toContain('sender');
    expect(missing).toContain('receiver');
  });
});

describe('TemperatureLog Model', () => {
  test('should create a temperature log', () => {
    const log = new models.TemperatureLog({
      boxId: 'box-1',
      temperature: 5.5,
      unit: 'C'
    });
    
    expect(log.boxId).toBe('box-1');
    expect(log.temperature).toBe(5.5);
    expect(log.unit).toBe('C');
  });

  test('should check if temperature is out of range', () => {
    const logNormal = new models.TemperatureLog({ temperature: 5.0 });
    const logOver = new models.TemperatureLog({ temperature: 10.0 });
    const logUnder = new models.TemperatureLog({ temperature: 0.0 });
    
    expect(logNormal.isOutOfRange(2, 8)).toBe(false);
    expect(logOver.isOutOfRange(2, 8)).toBe(true);
    expect(logUnder.isOutOfRange(2, 8)).toBe(true);
  });
});

describe('RiskEvent Model', () => {
  test('should create a risk event', () => {
    const risk = new models.RiskEvent({
      batchId: 'batch-1',
      type: 'temperature_violation',
      severity: 'high',
      title: '温度超温',
      description: '温度超过上限'
    });
    
    expect(risk.batchId).toBe('batch-1');
    expect(risk.type).toBe('temperature_violation');
    expect(risk.severity).toBe('high');
    expect(risk.status).toBe('open');
  });

  test('should update risk status', () => {
    const risk = new models.RiskEvent();
    expect(risk.status).toBe('open');
    
    risk.updateStatus('resolved', '问题已解决');
    expect(risk.status).toBe('resolved');
    expect(risk.resolutionNotes).toBe('问题已解决');
    expect(risk.resolvedAt).toBeDefined();
  });
});
