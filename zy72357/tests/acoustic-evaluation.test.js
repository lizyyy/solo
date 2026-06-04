const UnifiedDataAccess = require('../src/data/UnifiedDataAccess');

describe('声学隔断降噪评估系统', () => {
  let dataAccess;
  let evaluationId;

  beforeEach(() => {
    dataAccess = new UnifiedDataAccess();
    evaluationId = dataAccess.startNewEvaluation('老唐');
  });

  describe('三步工作流', () => {
    const temperatureRecords = [
      { sensorId: 'S001', calibrationTime: '2024-01-15 09:00:00', temperature: 23.5, humidity: 45 },
      { sensorId: 'S002', calibrationTime: null, temperature: 24.0, humidity: 48 },
      { sensorId: 'S003', calibrationTime: '2024-01-15 10:00:00', temperature: 22.8, humidity: 50 }
    ];

    const sensorRecords = [
      { sensorId: 'S001', siteStatement: '主设备区北侧，安装位置正确', installLocation: '主设备区-01', operator: '张三' },
      { sensorId: 'S002', siteStatement: '走廊区域，现场确认已校准', installLocation: '走廊-A区', operator: '李四' },
      { sensorId: 'S003', siteStatement: '机房内部，温度环境稳定', installLocation: '机房-02', operator: '王五' }
    ];

    test('第一步：温度校准记录导入', async () => {
      const result = await dataAccess.executeStep1(evaluationId, temperatureRecords);
      
      expect(result.success).toBe(true);
      expect(result.importResult.imported).toBe(3);
      expect(result.nextStage).toBe('sensor_review');
    });

    test('第二步：训练教练老唐查看传感器编号', async () => {
      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      const result = await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
      
      expect(result.success).toBe(true);
      expect(result.sensorResult.imported).toBe(3);
      expect(result.recordsNeedingReview.length).toBeGreaterThan(0);
      expect(result.alerts[0]).toContain('采样时间缺失');
    });

    test('第三步：实验复盘图更新，采样时间缺失留待质检员复核', async () => {
      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
      const result = await dataAccess.executeStep3(evaluationId, {}, '系统');
      
      expect(result.success).toBe(true);
      expect(result.recordsPendingQualityReview).toBe(1);
      expect(result.currentStage).toBe('quality_review');
    });
  });

  describe('基本自检功能', () => {
    test('重复导入检测', async () => {
      const duplicateRecords = [
        { sensorId: 'S001', calibrationTime: '2024-01-15 09:00:00', temperature: 23.5 },
        { sensorId: 'S001', calibrationTime: '2024-01-15 09:00:00', temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, duplicateRecords);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.duplicateImport.count).toBe(1);
      expect(status.selfCheckResults.duplicateImport.passed).toBe(false);
    });

    test('采样时间缺失检测', async () => {
      const recordsWithMissingTime = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 },
        { sensorId: 'S002', calibrationTime: '2024-01-15 09:00:00', temperature: 24.0 }
      ];

      await dataAccess.executeStep1(evaluationId, recordsWithMissingTime);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.missingSampleTime.count).toBe(1);
      expect(status.selfCheckResults.missingSampleTime.passed).toBe(false);
    });

    test('补录后重算', async () => {
      const records = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status1 = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status1.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        calibrationTime: '2024-01-15 09:30:00'
      }, '老唐', '补录采样时间');

      const recalcResult = dataAccess.recalculate(evaluationId);
      
      expect(recalcResult.recalculatedCount).toBe(1);
    });

    test('数据一致性验证（页面、接口、导出）', async () => {
      const temperatureRecords = [
        { sensorId: 'S001', calibrationTime: '2024-01-15 09:00:00', temperature: 23.5, humidity: 45 },
        { sensorId: 'S002', calibrationTime: null, temperature: 24.0, humidity: 48 }
      ];
      const sensorRecords = [
        { sensorId: 'S001', siteStatement: '主设备区', installLocation: '主设备区-01' },
        { sensorId: 'S002', siteStatement: '走廊区域', installLocation: '走廊-A区' }
      ];

      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');

      const consistency = dataAccess.verifyDataConsistency(evaluationId);
      
      expect(consistency.isConsistent).toBe(true);
      expect(consistency.checks.recordCount.consistent).toBe(true);
      expect(consistency.checks.missingTimeCount.consistent).toBe(true);
    });
  });

  describe('数据追踪和审计', () => {
    test('保留原始行号、人工改动、处理状态', async () => {
      const records = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        calibrationTime: '2024-01-15 09:30:00'
      }, '老唐', '补录采样时间');

      const auditTrail = dataAccess.getAuditTrail(evaluationId, recordId);
      
      expect(auditTrail.sourceLineNumber).toBe(2);
      expect(auditTrail.manualChanges.length).toBe(1);
      expect(auditTrail.manualChanges[0].operator).toBe('老唐');
      expect(auditTrail.processingStatus).toBe('supplemented');
      expect(auditTrail.originalData.calibrationTime).toBeNull();
    });

    test('质检员可追溯到原始证据', async () => {
      const records = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      const displayData = dataAccess.getResultsForDisplay(evaluationId);
      const record = displayData.records.find(r => r.recordId === recordId);
      
      expect(record.sourceLineNumber).toBeDefined();
      expect(record.originalData).toBeDefined();
      expect(record.manualChanges).toBeDefined();
      expect(record.needsQualityReview).toBe(true);
    });
  });

  describe('质量复核流程', () => {
    test('采样时间缺失记录不自动归为正常', async () => {
      const temperatureRecords = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5, humidity: 45 }
      ];
      const sensorRecords = [
        { sensorId: 'S001', siteStatement: '主设备区', installLocation: '主设备区-01' }
      ];

      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
      await dataAccess.executeStep3(evaluationId, {}, '系统');

      const results = dataAccess.getResultsForAPI(evaluationId);
      
      expect(results.data.summary.recordsNeedingReview).toBe(1);
      expect(results.data.records[0].qualityReviewStatus).toBe('pending');
    });

    test('质检员可以通过或拒绝记录', async () => {
      const records = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      const result = dataAccess.qualityReview(
        evaluationId, 
        recordId, 
        '质检员A', 
        'approve', 
        '数据可接受'
      );
      
      expect(result.processingStatus).toBe('quality_approved');
    });
  });

  describe('版本管理', () => {
    test('补录后版本号递增', async () => {
      const records = [
        { sensorId: 'S001', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const results1 = dataAccess.getResultsForAPI(evaluationId);
      const recordId = results1.data.records[0].id;

      dataAccess.supplementData(evaluationId, recordId, {
        calibrationTime: '2024-01-15 09:30:00'
      }, '老唐', '补录采样时间');

      const results2 = dataAccess.getResultsForAPI(evaluationId);
      
      expect(results2.data.version).toBeGreaterThan(results1.data.version);
    });
  });
});
