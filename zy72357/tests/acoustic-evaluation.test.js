const UnifiedDataAccess = require('../src/data/UnifiedDataAccess');

describe('声学隔断降噪评估系统 - 完整链路', () => {
  let dataAccess;
  let evaluationId;

  beforeEach(() => {
    dataAccess = new UnifiedDataAccess();
    evaluationId = dataAccess.startNewEvaluation('老唐');
  });

  describe('三步工作流', () => {
    const temperatureRecords = [
      { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5, humidity: 45, notes: '正常校准记录' },
      { sensorId: 'S002', sampleStartTime: '2024-01-15 10:00:00', sampleDurationMinutes: 15, temperature: 24.0, humidity: 48, notes: '现场采样时设备提前断电，时长不够' },
      { sensorId: 'S003', sampleStartTime: '2024-01-15 11:00:00', sampleDurationMinutes: 30, temperature: 22.8, humidity: 50, notes: '机房内采样' },
      { sensorId: 'S004', calibrationTime: null, temperature: 25.0, humidity: 52, notes: '完全没写采样时间' }
    ];

    const sensorRecords = [
      { sensorId: 'S001', siteStatement: '主设备区北侧，安装位置正确，底座稳固', installLocation: '主设备区-01', operator: '张三' },
      { sensorId: 'S002', siteStatement: '走廊区域，现场确认已校准但时长短', installLocation: '走廊-A区', operator: '李四' },
      { sensorId: 'S003', siteStatement: '机房内部，温度环境稳定，空调正常', installLocation: '机房-02', operator: '王五' },
      { sensorId: 'S004', siteStatement: '仓库角落，安装时忘记记时间', installLocation: '仓库-B1', operator: '赵六' }
    ];

    test('第一步：温度校准记录导入 - 时长不足30分钟的应标记问题', async () => {
      const result = await dataAccess.executeStep1(evaluationId, temperatureRecords);
      
      expect(result.success).toBe(true);
      expect(result.importResult.imported).toBe(4);
      expect(result.nextStage).toBe('sensor_review');
    });

    test('第二步：训练教练老唐查看传感器编号 - 采样时长15分钟应触发复核', async () => {
      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      const result = await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
      
      expect(result.success).toBe(true);
      expect(result.sensorResult.imported).toBe(4);
      expect(result.recordsNeedingReview.length).toBeGreaterThanOrEqual(2);
      expect(result.alerts[0]).toContain('采样时间缺失');
    });

    test('第三步：实验复盘图更新，采样时间缺半小时不自动归正常', async () => {
      await dataAccess.executeStep1(evaluationId, temperatureRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecords, '老唐');
      const result = await dataAccess.executeStep3(evaluationId, {}, '系统');
      
      expect(result.success).toBe(true);
      expect(result.recordsPendingQualityReview).toBeGreaterThanOrEqual(2);
      expect(result.currentStage).toBe('quality_review');
    });
  });

  describe('采样时长不足30分钟（核心问题）', () => {
    test('采样时长15分钟应检测为duration_short类型', async () => {
      const records = [
        { sensorId: 'T001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 15, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const detail = status.selfCheckResults.missingSampleTime.details[0];
      
      expect(detail.issueType).toBe('duration_short');
      expect(detail.missingMinutes).toBe(15);
      expect(detail.actualMinutes).toBe(15);
      expect(detail.severity).toBe('high');
    });

    test('采样时间完全为空应检测为empty类型', async () => {
      const records = [
        { sensorId: 'T002', calibrationTime: null, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const detail = status.selfCheckResults.missingSampleTime.details[0];
      
      expect(detail.issueType).toBe('empty');
      expect(detail.missingMinutes).toBe(30);
    });

    test('采样开始时间有、结束时间无且未提供时长 → missing_end_or_duration', async () => {
      const records = [
        { sensorId: 'T003', sampleStartTime: '2024-01-15 09:00:00', temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const detail = status.selfCheckResults.missingSampleTime.details[0];
      
      expect(detail.issueType).toBe('missing_end_or_duration');
    });

    test('采样时长刚好30分钟 → 正常无问题', async () => {
      const records = [
        { sensorId: 'T004', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.missingSampleTime.passed).toBe(true);
      expect(status.selfCheckResults.missingSampleTime.count).toBe(0);
    });

    test('采样时长45分钟 → 正常无问题', async () => {
      const records = [
        { sensorId: 'T005', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 45, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.missingSampleTime.passed).toBe(true);
    });
  });

  describe('基本自检功能', () => {
    test('重复导入检测', async () => {
      const duplicateRecords = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5 },
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, duplicateRecords);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.duplicateImport.count).toBe(1);
      expect(status.selfCheckResults.duplicateImport.passed).toBe(false);
    });

    test('采样时间缺半小时检测（时长15分钟）', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 15, temperature: 23.5 },
        { sensorId: 'S002', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 24.0 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      
      expect(status.selfCheckResults.missingSampleTime.count).toBe(1);
      expect(status.selfCheckResults.missingSampleTime.details[0].missingMinutes).toBe(15);
      expect(status.selfCheckResults.missingSampleTime.passed).toBe(false);
    });

    test('补录后重算 - 把15分钟补到30分钟', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 15, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status1 = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status1.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '补录完整采样时长，原15分钟，补到30分钟');

      const recalcResult = dataAccess.recalculate(evaluationId);
      
      expect(recalcResult.recalculatedCount).toBe(1);
    });

    test('数据一致性验证 - 6处数据源全部一致', async () => {
      const temperatureRecords = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5 },
        { sensorId: 'S002', sampleStartTime: '2024-01-15 10:00:00', sampleDurationMinutes: 15, temperature: 24.0 }
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
      expect(consistency.checks.qualityReviewCount.consistent).toBe(true);
      expect(consistency.summary.totalSourcesVerified).toBe(6);
    });
  });

  describe('数据追踪和审计 - 保留证据链', () => {
    test('原始行号、人工改动、处理状态、原始说法、改后值、下一步找谁', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 10, temperature: 23.5, notes: '当时现场人多，采了10分钟就走了' }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '按质检员要求补录到30分钟，补记采样时段');

      const auditTrail = dataAccess.getAuditTrail(evaluationId, recordId);
      
      expect(auditTrail.sourceLineNumber).toBe(2);
      expect(auditTrail.manualChanges.length).toBe(1);
      expect(auditTrail.manualChanges[0].operator).toBe('老唐');
      expect(auditTrail.manualChanges[0].processingReason).toBe('按质检员要求补录到30分钟，补记采样时段');
      expect(auditTrail.originalStatement).toBe('当时现场人多，采了10分钟就走了');
      expect(auditTrail.manualChanges[0].originalValue).toBe('10');
      expect(auditTrail.manualChanges[0].correctedValue).toBe('30');
      expect(auditTrail.qualityReview.nextHandler).toBe('质检员');
      expect(auditTrail.processingStatus).toBe('supplemented');
    });

    test('质检员可追溯到原始证据 - 通过列表→详情→审计', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 20, temperature: 23.5, notes: '开始采了20分钟，后来记录忘写了' }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const displayData = dataAccess.getResultsForDisplay(evaluationId);
      const record = displayData.records[0];
      
      expect(record.sourceLineNumber).toBeDefined();
      expect(record.originalData).toBeDefined();
      expect(record.manualChanges).toBeDefined();
      expect(record.needsQualityReview).toBe(true);
      expect(record.qualityReview.nextHandler).toBe('质检员');
      expect(record.auditTrail.originalStatement).toBe('开始采了20分钟，后来记录忘写了');
      expect(record.summary).toContain('缺10分钟');
    });
  });

  describe('质量复核流程', () => {
    const tempRecords = [
      { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 15, temperature: 23.5, notes: '采样时断了一次' }
    ];
    const sensorRecs = [
      { sensorId: 'S001', siteStatement: '主设备区', installLocation: '主设备区-01' }
    ];

    test('采样时长15分钟 - 留待质检员复核，不提前归正常', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecs, '老唐');
      await dataAccess.executeStep3(evaluationId, {}, '系统');

      const results = dataAccess.getResultsForAPI(evaluationId);
      
      expect(results.data.summary.recordsNeedingReview).toBe(1);
      expect(results.data.records[0].qualityReview.status).toBe('pending');
      expect(results.data.records[0].durationCompliant).toBe(false);
    });

    test('补录时长后仍然需要复核，不自动归正常', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '补录到30分钟');
      dataAccess.recalculate(evaluationId);

      const results = dataAccess.getResultsForAPI(evaluationId);
      expect(results.data.records[0].qualityReview.status).not.toBe('approved');
      expect(results.data.records[0].needsQualityReview).toBe(true);
    });

    test('质检员可以通过记录', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '补录时长');
      dataAccess.recalculate(evaluationId);

      const result = dataAccess.qualityReview(
        evaluationId, 
        recordId, 
        '质检员A', 
        'approve', 
        '时长已补录到位，数据可信'
      );
      
      expect(result.qualityReview.status).toBe('approved');
      expect(result.processingStatus).toBe('quality_approved');
      expect(result.qualityReview.reviewer).toBe('质检员A');
    });

    test('质检员可以拒绝记录', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      const status = dataAccess.getWorkflowStatus(evaluationId);
      const recordId = status.selfCheckResults.missingSampleTime.details[0].recordId;

      const result = dataAccess.qualityReview(
        evaluationId, 
        recordId, 
        '质检员B', 
        'reject', 
        '采样时长不足，请重新采集'
      );
      
      expect(result.qualityReview.status).toBe('rejected');
      expect(result.processingStatus).toBe('quality_rejected');
      expect(result.qualityReview.nextHandler).toBe('训练教练（补录）');
    });
  });

  describe('版本管理', () => {
    test('补录操作后版本号递增', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 20, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const results1 = dataAccess.getResultsForAPI(evaluationId);
      const recordId = results1.data.records[0].id;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '补录采样时长');

      const results2 = dataAccess.getResultsForAPI(evaluationId);
      
      expect(results2.data.version).toBeGreaterThan(results1.data.version);
    });

    test('补录后重算，版本号继续递增', async () => {
      const records = [
        { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 10, temperature: 23.5 }
      ];

      await dataAccess.executeStep1(evaluationId, records);
      const results1 = dataAccess.getResultsForAPI(evaluationId);
      const recordId = results1.data.records[0].id;

      dataAccess.supplementData(evaluationId, recordId, {
        sampleDurationMinutes: 30
      }, '老唐', '补录时长');
      const v2 = dataAccess.getResultsForAPI(evaluationId).data.version;

      dataAccess.recalculate(evaluationId);
      const v3 = dataAccess.getResultsForAPI(evaluationId).data.version;
      
      expect(v3).toBeGreaterThan(v2);
    });
  });

  describe('导出/报告一致性', () => {
    const tempRecords = [
      { sensorId: 'S001', sampleStartTime: '2024-01-15 09:00:00', sampleDurationMinutes: 30, temperature: 23.5 },
      { sensorId: 'S002', sampleStartTime: '2024-01-15 10:00:00', sampleDurationMinutes: 18, temperature: 24.0, notes: '采样时长18分钟，差12分钟' },
      { sensorId: 'S003', calibrationTime: null, temperature: 22.0, notes: '时间完全没填' }
    ];
    const sensorRecs = [
      { sensorId: 'S001', siteStatement: '主设备区北侧', installLocation: '主设备区-01' },
      { sensorId: 'S002', siteStatement: '走廊A区东侧', installLocation: '走廊-A区' },
      { sensorId: 'S003', siteStatement: '仓库B1角落', installLocation: '仓库-B1' }
    ];

    test('导出明细包含原始行号、原始说法、问题描述、缺失分钟、下一步找谁', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecs, '老唐');
      await dataAccess.executeStep3(evaluationId, {}, '系统');

      const exportData = dataAccess.getResultsForExport(evaluationId);
      
      expect(exportData.details.length).toBe(3);
      expect(exportData.details[1].原始行号).toBe(3);
      expect(exportData.details[1].原始说法).toContain('差12分钟');
      expect(exportData.details[1].采样时间问题描述).toContain('仅18分钟');
      expect(exportData.details[1].缺失分钟数).toBe(12);
      expect(exportData.details[1].下一步处理).toBeDefined();
    });

    test('历史记录和报告同步展示同一份最新数据', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecs, '老唐');
      await dataAccess.executeStep3(evaluationId, {}, '系统');

      const history = dataAccess.getResultsForExport(evaluationId).history;
      const report = dataAccess.getReport(evaluationId);
      
      expect(history.length).toBe(3);
      expect(history[1].初始问题类型).toBe('duration_short');
      expect(history[1].缺失分钟数).toBe(12);
      expect(history[1].下一步找谁).toBe('质检员');
      
      expect(report.recordAudits.length).toBe(3);
      expect(report.recordAudits[1].sampleTimeIssue.type).toBe('duration_short');
      expect(report.recordAudits[1].isInNormalResults).toBe(false);
    });

    test('导出一致性自检通过', async () => {
      await dataAccess.executeStep1(evaluationId, tempRecords);
      await dataAccess.executeStep2(evaluationId, sensorRecs, '老唐');
      await dataAccess.executeStep3(evaluationId, {}, '系统');

      const exportData = dataAccess.getResultsForExport(evaluationId);
      
      expect(exportData.selfCheckReport.exportConsistency.passed).toBe(true);
      expect(exportData.dataConsistencyNote).toContain('integratedResults');
    });
  });
});
