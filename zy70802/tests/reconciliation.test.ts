import { ReconciliationEngine } from '../src/services/ReconciliationEngine';
import { DataStore } from '../src/store/DataStore';

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine;
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = DataStore.getInstance();
    dataStore.clearAll();
    engine = new ReconciliationEngine();
  });

  it('should detect no callback discrepancy', async () => {
    dataStore.addCriticalValue({
      patientId: 'P001',
      patientName: '张三',
      department: '急诊科',
      ward: '急诊一区',
      bedNo: '101',
      testItem: '血钾',
      testResult: '6.8mmol/L',
      referenceRange: '3.5-5.5mmol/L',
      priority: 'emergency',
      reportedAt: new Date('2024-01-15T02:30:00'),
      reportedBy: '李检验',
    });

    const results = await engine.runReconciliation();

    expect(results.length).toBe(1);
    const discrepancies = results[0].discrepancies;
    const noCallback = discrepancies.find(d => d.type === 'no_callback');
    expect(noCallback).toBeDefined();
  });

  it('should detect callback timeout for emergency priority', async () => {
    const cv = dataStore.addCriticalValue({
      patientId: 'P001',
      patientName: '张三',
      department: '急诊科',
      ward: '急诊一区',
      bedNo: '101',
      testItem: '血钾',
      testResult: '6.8mmol/L',
      referenceRange: '3.5-5.5mmol/L',
      priority: 'emergency',
      reportedAt: new Date('2024-01-15T02:30:00'),
      reportedBy: '李检验',
    });

    dataStore.addCallback({
      patientId: 'P001',
      patientName: '张三',
      calledAt: new Date('2024-01-15T02:45:00'),
      calledBy: '李检验',
      calledTo: '13800138001',
      doctorName: '张医生',
      confirmedAt: new Date('2024-01-15T02:46:00'),
      confirmationNotes: '已收到',
      callResult: 'connected',
    });

    const results = await engine.runReconciliation();

    const timeoutDisc = results[0].discrepancies.find(d => d.type === 'callback_timeout');
    expect(timeoutDisc).toBeDefined();
    expect(timeoutDisc?.severity).toBe('high');
  });

  it('should detect multiple critical values for same patient', async () => {
    dataStore.addCriticalValue({
      patientId: 'P001',
      patientName: '张三',
      department: '急诊科',
      ward: '急诊一区',
      bedNo: '101',
      testItem: '血钾',
      testResult: '6.8mmol/L',
      referenceRange: '3.5-5.5mmol/L',
      priority: 'emergency',
      reportedAt: new Date('2024-01-15T02:30:00'),
      reportedBy: '李检验',
    });

    dataStore.addCriticalValue({
      patientId: 'P001',
      patientName: '张三',
      department: '急诊科',
      ward: '急诊一区',
      bedNo: '101',
      testItem: '肌钙蛋白T',
      testResult: '0.52ng/mL',
      referenceRange: '<0.014ng/mL',
      priority: 'emergency',
      reportedAt: new Date('2024-01-15T02:40:00'),
      reportedBy: '李检验',
    });

    const results = await engine.runReconciliation();

    const hasMultiple = results.some(r => 
      r.discrepancies.some(d => d.type === 'multiple_critical_values')
    );
    expect(hasMultiple).toBe(true);
  });

  it('should generate summary report', async () => {
    dataStore.addCriticalValue({
      patientId: 'P001',
      patientName: '张三',
      department: '急诊科',
      ward: '急诊一区',
      bedNo: '101',
      testItem: '血钾',
      testResult: '6.8mmol/L',
      referenceRange: '3.5-5.5mmol/L',
      priority: 'emergency',
      reportedAt: new Date('2024-01-15T02:30:00'),
      reportedBy: '李检验',
    });

    await engine.runReconciliation();
    const summary = engine.getSummary();

    expect(summary.totalCriticalValues).toBe(1);
    expect(summary.mismatchedCount).toBe(1);
    expect(summary.discrepancyBreakdown.no_callback).toBe(1);
  });
});
