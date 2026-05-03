const moment = require('moment');
const models = require('../../models');
const repositories = require('../../repositories');
const { RuleEngine } = require('../../rules');
const { RISK_TYPES } = require('../../models/riskEvent');
const { STATES } = require('../../models/stateMachine');

describe('Rule Engine', () => {
  let ruleEngine;
  let batchRepo;
  let boxRepo;
  let temperatureLogRepo;
  let handoverFormRepo;
  let riskEventRepo;

  beforeEach(() => {
    batchRepo = new repositories.BatchRepository();
    boxRepo = new repositories.BoxRepository();
    temperatureLogRepo = new repositories.TemperatureLogRepository();
    handoverFormRepo = new repositories.HandoverFormRepository();
    riskEventRepo = new repositories.RiskEventRepository();
    
    batchRepo.clear();
    boxRepo.clear();
    temperatureLogRepo.clear();
    handoverFormRepo.clear();
    riskEventRepo.clear();
    
    ruleEngine = new RuleEngine();
  });

  describe('Temperature Rule', () => {
    test('should detect temperature violation when over limit', async () => {
      const box = new models.Box({
        name: '保温箱-001'
      });
      boxRepo.create(box);

      const batch = new models.Batch({
        batchNumber: 'VAC-001',
        boxId: box.id,
        scheduledDepartureTime: moment().subtract(2, 'hours').toISOString(),
        scheduledArrivalTime: moment().subtract(1, 'hours').toISOString(),
        actualDepartureTime: moment().subtract(2, 'hours').toISOString(),
        actualArrivalTime: moment().subtract(1, 'hours').toISOString()
      });
      batchRepo.create(batch);

      const baseTime = moment().subtract(1.5, 'hours');
      for (let i = 0; i < 10; i++) {
        const temp = i >= 3 && i <= 6 ? 10.5 : 5.0;
        temperatureLogRepo.create(new models.TemperatureLog({
          boxId: box.id,
          timestamp: baseTime.clone().add(i * 5, 'minutes').toISOString(),
          temperature: temp
        }));
      }

      const result = await ruleEngine.runRulesForBatch(batch);
      
      expect(result.risks.length).toBeGreaterThan(0);
      const tempRisks = result.risks.filter(r => r.type === RISK_TYPES.TEMPERATURE_VIOLATION);
      expect(tempRisks.length).toBeGreaterThan(0);

      const updatedBatch = batchRepo.findById(batch.id);
      expect(updatedBatch.riskFlags.temperatureViolation).toBe(true);
    });

    test('should detect temperature violation when under limit', async () => {
      const box = new models.Box({
        name: '保温箱-002'
      });
      boxRepo.create(box);

      const batch = new models.Batch({
        batchNumber: 'VAC-002',
        boxId: box.id,
        scheduledDepartureTime: moment().subtract(2, 'hours').toISOString(),
        scheduledArrivalTime: moment().subtract(1, 'hours').toISOString(),
        actualDepartureTime: moment().subtract(2, 'hours').toISOString(),
        actualArrivalTime: moment().subtract(1, 'hours').toISOString()
      });
      batchRepo.create(batch);

      const baseTime = moment().subtract(1.5, 'hours');
      for (let i = 0; i < 10; i++) {
        const temp = i >= 3 && i <= 6 ? -0.5 : 5.0;
        temperatureLogRepo.create(new models.TemperatureLog({
          boxId: box.id,
          timestamp: baseTime.clone().add(i * 5, 'minutes').toISOString(),
          temperature: temp
        }));
      }

      const result = await ruleEngine.runRulesForBatch(batch);
      
      expect(result.risks.length).toBeGreaterThan(0);
      const tempRisks = result.risks.filter(r => r.type === RISK_TYPES.TEMPERATURE_VIOLATION);
      expect(tempRisks.length).toBeGreaterThan(0);
    });

    test('should not create risk when temperature is normal', async () => {
      const box = new models.Box({
        name: '保温箱-003'
      });
      boxRepo.create(box);

      const batch = new models.Batch({
        batchNumber: 'VAC-003',
        boxId: box.id,
        scheduledDepartureTime: moment().subtract(2, 'hours').toISOString(),
        scheduledArrivalTime: moment().subtract(1, 'hours').toISOString(),
        actualDepartureTime: moment().subtract(2, 'hours').toISOString(),
        actualArrivalTime: moment().subtract(1, 'hours').toISOString()
      });
      batchRepo.create(batch);

      const baseTime = moment().subtract(1.5, 'hours');
      for (let i = 0; i < 10; i++) {
        const temp = 4.5 + Math.random() * 2;
        temperatureLogRepo.create(new models.TemperatureLog({
          boxId: box.id,
          timestamp: baseTime.clone().add(i * 5, 'minutes').toISOString(),
          temperature: parseFloat(temp.toFixed(1))
        }));
      }

      const result = await ruleEngine.runRulesForBatch(batch);
      
      const tempRisks = result.risks.filter(r => r.type === RISK_TYPES.TEMPERATURE_VIOLATION);
      expect(tempRisks.length).toBe(0);

      const updatedBatch = batchRepo.findById(batch.id);
      expect(updatedBatch.riskFlags.temperatureViolation).toBe(false);
    });
  });

  describe('Delay Rule', () => {
    test('should detect delay when actual arrival is late', async () => {
      const batch = new models.Batch({
        batchNumber: 'VAC-DELAY-001',
        scheduledDepartureTime: moment().subtract(3, 'hours').toISOString(),
        scheduledArrivalTime: moment().subtract(2, 'hours').toISOString(),
        actualDepartureTime: moment().subtract(3, 'hours').toISOString(),
        actualArrivalTime: moment().subtract(1, 'hours').toISOString()
      });
      batchRepo.create(batch);

      expect(batch.getDelayMinutes()).toBe(60);
      expect(batch.isDelayed(15)).toBe(true);

      const result = await ruleEngine.runRulesForBatch(batch);
      
      const delayRisks = result.risks.filter(r => r.type === RISK_TYPES.DELAY);
      expect(delayRisks.length).toBe(1);

      const updatedBatch = batchRepo.findById(batch.id);
      expect(updatedBatch.riskFlags.delay).toBe(true);
    });

    test('should not detect delay when on time', async () => {
      const batch = new models.Batch({
        batchNumber: 'VAC-ON-TIME-001',
        scheduledDepartureTime: moment().subtract(3, 'hours').toISOString(),
        scheduledArrivalTime: moment().subtract(2, 'hours').toISOString(),
        actualDepartureTime: moment().subtract(3, 'hours').toISOString(),
        actualArrivalTime: moment().subtract(2, 'hours').add(5, 'minutes').toISOString()
      });
      batchRepo.create(batch);

      expect(batch.getDelayMinutes()).toBe(5);
      expect(batch.isDelayed(15)).toBe(false);

      const result = await ruleEngine.runRulesForBatch(batch);
      
      const delayRisks = result.risks.filter(r => r.type === RISK_TYPES.DELAY);
      expect(delayRisks.length).toBe(0);
    });
  });

  describe('Signature Rule', () => {
    test('should detect missing receiver signature', async () => {
      const batch = new models.Batch({
        batchNumber: 'VAC-SIG-001'
      });
      batchRepo.create(batch);

      const form = new models.HandoverForm({
        formNumber: 'HO-001',
        batchId: batch.id
      });
      form.signSender('sig-sender-1');
      handoverFormRepo.create(form);

      expect(form.isSenderSigned()).toBe(true);
      expect(form.isReceiverSigned()).toBe(false);
      expect(form.hasCompleteSignatures()).toBe(false);
      expect(form.getMissingSignatures()).toContain('receiver');

      const result = await ruleEngine.runRulesForBatch(batch);
      
      const signatureRisks = result.risks.filter(r => r.type === RISK_TYPES.SIGNATURE_MISSING);
      expect(signatureRisks.length).toBe(1);

      const updatedBatch = batchRepo.findById(batch.id);
      expect(updatedBatch.riskFlags.signatureMissing).toBe(true);
    });

    test('should not detect risk when signatures are complete', async () => {
      const batch = new models.Batch({
        batchNumber: 'VAC-SIG-002'
      });
      batchRepo.create(batch);

      const form = new models.HandoverForm({
        formNumber: 'HO-002',
        batchId: batch.id
      });
      form.signSender('sig-sender-2');
      form.signReceiver('sig-receiver-2');
      handoverFormRepo.create(form);

      expect(form.hasCompleteSignatures()).toBe(true);
      expect(form.getMissingSignatures().length).toBe(0);

      const result = await ruleEngine.runRulesForBatch(batch);
      
      const signatureRisks = result.risks.filter(r => r.type === RISK_TYPES.SIGNATURE_MISSING);
      expect(signatureRisks.length).toBe(0);
    });
  });

  describe('Risk Summary', () => {
    test('should generate risk summary', async () => {
      const batch1 = new models.Batch({ batchNumber: 'B1' });
      const batch2 = new models.Batch({ batchNumber: 'B2' });
      batchRepo.create(batch1);
      batchRepo.create(batch2);

      const risk1 = new models.RiskEvent({
        batchId: batch1.id,
        type: RISK_TYPES.TEMPERATURE_VIOLATION,
        severity: 'high',
        status: 'open'
      });
      const risk2 = new models.RiskEvent({
        batchId: batch1.id,
        type: RISK_TYPES.DELAY,
        severity: 'medium',
        status: 'open'
      });
      const risk3 = new models.RiskEvent({
        batchId: batch2.id,
        type: RISK_TYPES.SIGNATURE_MISSING,
        severity: 'medium',
        status: 'resolved'
      });

      riskEventRepo.create(risk1);
      riskEventRepo.create(risk2);
      riskEventRepo.create(risk3);

      const summary = ruleEngine.getRiskSummary();

      expect(summary.total).toBe(3);
      expect(summary.byType.temperature_violation).toBe(1);
      expect(summary.byType.delay).toBe(1);
      expect(summary.byType.signature_missing).toBe(1);
      expect(summary.byStatus.open).toBe(2);
      expect(summary.byStatus.resolved).toBe(1);
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.medium).toBe(2);
    });
  });
});
