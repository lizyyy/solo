import { addMinutes, parseISO } from 'date-fns';
import { RuleEngine } from '../src/rules';
import { TemperatureRecord, DoorRecord, VaccineBatch } from '../src/types';

describe('RuleEngine', () => {
  const ruleEngine = new RuleEngine();
  const baseDate = parseISO('2026-05-01T08:00:00');

  describe('over temperature detection', () => {
    it('should detect over temperature anomaly', () => {
      const records: TemperatureRecord[] = [];
      
      for (let i = 0; i < 30; i++) {
        records.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 10 && i <= 20 ? 9.5 + (Math.random() - 0.5) : 4.5,
          isValid: true,
          rawValue: '',
        });
      }

      const analysis = ruleEngine.analyze(records, [], []);
      
      const overTempAnomalies = analysis.anomalies.filter(a => a.type === 'over_temp');
      
      expect(overTempAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('under temperature detection', () => {
    it('should detect under temperature anomaly', () => {
      const records: TemperatureRecord[] = [];
      
      for (let i = 0; i < 30; i++) {
        records.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 10 && i <= 20 ? 0.5 + (Math.random() - 0.5) * 0.5 : 4.5,
          isValid: true,
          rawValue: '',
        });
      }

      const analysis = ruleEngine.analyze(records, [], []);
      
      const underTempAnomalies = analysis.anomalies.filter(a => a.type === 'under_temp');
      
      expect(underTempAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('probe disconnect detection', () => {
    it('should detect probe disconnect when temperature is extremely low', () => {
      const records: TemperatureRecord[] = [];
      
      for (let i = 0; i < 30; i++) {
        records.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 10 && i <= 20 ? -100 : 4.5,
          isValid: i < 10 || i > 20,
          rawValue: i >= 10 && i <= 20 ? 'ERROR' : '4.5',
        });
      }

      const analysis = ruleEngine.analyze(records, [], []);
      
      const disconnectAnomalies = analysis.anomalies.filter(a => a.type === 'probe_disconnect');
      
      expect(disconnectAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect invalid temperature records as probe disconnect', () => {
      const records: TemperatureRecord[] = [];
      
      for (let i = 0; i < 30; i++) {
        records.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 10 && i <= 20 ? -999 : 4.5,
          isValid: i < 10 || i > 20,
          rawValue: i >= 10 && i <= 20 ? 'N/A' : '4.5',
        });
      }

      const analysis = ruleEngine.analyze(records, [], []);
      
      const disconnectAnomalies = analysis.anomalies.filter(a => a.type === 'probe_disconnect');
      
      expect(disconnectAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('rapid temperature change detection', () => {
    it('should detect rapid temperature changes', () => {
      const records: TemperatureRecord[] = [];
      
      for (let i = 0; i < 20; i++) {
        let temp = 4.5;
        if (i === 5) temp = 4.0;
        if (i === 6) temp = 8.5;
        if (i === 7) temp = 3.8;
        
        records.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: temp,
          isValid: true,
          rawValue: temp.toString(),
        });
      }

      const analysis = ruleEngine.analyze(records, [], []);
      
      const rapidChangeAnomalies = analysis.anomalies.filter(a => a.type === 'rapid_change');
      
      expect(rapidChangeAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('door open long detection', () => {
    it('should detect long door opening', () => {
      const doorRecords: DoorRecord[] = [
        {
          timestamp: addMinutes(baseDate, 0),
          fridgeId: 'FRIDGE-001',
          eventType: 'open',
          duration: 10,
          operator: '测试员',
        },
        {
          timestamp: addMinutes(baseDate, 10),
          fridgeId: 'FRIDGE-001',
          eventType: 'close',
          duration: 10,
          operator: '测试员',
        },
      ];

      const tempRecords: TemperatureRecord[] = [];
      for (let i = 0; i < 30; i++) {
        tempRecords.push({
          timestamp: addMinutes(baseDate, i * 2),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: 4.5,
          isValid: true,
          rawValue: '4.5',
        });
      }

      const analysis = ruleEngine.analyze(tempRecords, doorRecords, []);
      
      const doorOpenAnomalies = analysis.anomalies.filter(a => a.type === 'door_open_long');
      
      expect(doorOpenAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('risk fragment generation', () => {
    it('should generate risk fragments for affected vaccine batches', () => {
      const tempRecords: TemperatureRecord[] = [];
      
      for (let i = 0; i < 50; i++) {
        tempRecords.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 20 && i <= 35 ? 10.5 : 4.5,
          isValid: true,
          rawValue: '',
        });
      }

      const vaccineBatches: VaccineBatch[] = [
        {
          batchId: 'VAC-001',
          vaccineName: '新冠疫苗',
          manufacturer: '中生',
          quantity: 100,
          minTemp: 2,
          maxTemp: 8,
          validFrom: baseDate,
          validTo: addMinutes(baseDate, 1440 * 365),
          fridgeId: 'FRIDGE-001',
          entryDate: baseDate,
        },
      ];

      const analysis = ruleEngine.analyze(tempRecords, [], vaccineBatches);
      
      expect(analysis.riskFragments.length).toBeGreaterThan(0);
      expect(analysis.riskFragments[0].batchId).toBe('VAC-001');
    });

    it('should include recommended actions in risk fragments', () => {
      const tempRecords: TemperatureRecord[] = [];
      
      for (let i = 0; i < 50; i++) {
        tempRecords.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: i >= 20 && i <= 35 ? 12.0 : 4.5,
          isValid: true,
          rawValue: '',
        });
      }

      const vaccineBatches: VaccineBatch[] = [
        {
          batchId: 'VAC-001',
          vaccineName: '乙肝疫苗',
          manufacturer: '康泰',
          quantity: 50,
          minTemp: 2,
          maxTemp: 8,
          validFrom: baseDate,
          validTo: addMinutes(baseDate, 1440 * 365),
          fridgeId: 'FRIDGE-001',
          entryDate: baseDate,
        },
      ];

      const analysis = ruleEngine.analyze(tempRecords, [], vaccineBatches);
      
      expect(analysis.riskFragments.length).toBeGreaterThan(0);
      
      const fragment = analysis.riskFragments[0];
      expect(fragment.recommendedAction).toBeDefined();
      expect(fragment.recommendedAction.actions.length).toBeGreaterThan(0);
      expect(fragment.recommendedAction.responsibleRole).toBe('冷链管理员');
    });
  });

  describe('analysis summary', () => {
    it('should generate correct summary statistics', () => {
      const tempRecords: TemperatureRecord[] = [];
      
      for (let i = 0; i < 10; i++) {
        tempRecords.push({
          timestamp: addMinutes(baseDate, i * 5),
          fridgeId: 'FRIDGE-001',
          probeId: 'PROBE-01',
          temperature: 4.5,
          isValid: true,
          rawValue: '4.5',
        });
      }

      const analysis = ruleEngine.analyze(tempRecords, [], []);
      
      expect(analysis.summary.totalRecords).toBe(10);
      expect(analysis.summary.timeRange.start).toBeDefined();
      expect(analysis.summary.timeRange.end).toBeDefined();
    });
  });
});
