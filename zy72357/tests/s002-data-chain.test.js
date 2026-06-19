const moment = require('moment');
const UnifiedDataAccess = require('../src/data/UnifiedDataAccess');

describe('声学隔断降噪评估系统 - S002 数据链完整性', () => {
  let uda;
  let evaluationId;
  let s002RecordId;

  const temperatureData = [
    {
      sensorId: 'S001',
      sampleStartTime: '2024-01-15 09:00:00',
      sampleDurationMinutes: 45,
      temperature: 23.5,
      humidity: 45,
      notes: '会议室正常采样，全程无间断'
    },
    {
      sensorId: 'S002',
      sampleStartTime: '2024-01-15 10:00:00',
      sampleDurationMinutes: 15,
      temperature: 24,
      humidity: 48,
      notes: '走廊区域采样，中途设备断电，实际采了15分钟就结束了'
    },
    {
      sensorId: 'S003',
      sampleStartTime: '2024-01-15 11:00:00',
      sampleDurationMinutes: 30,
      temperature: 24.5,
      humidity: 47,
      notes: '办公区标准采样'
    },
    {
      sensorId: 'S004',
      temperature: 25,
      humidity: 50,
      notes: ''
    }
  ];

  const sensorData = [
    { sensorId: 'S001', siteStatement: '会议室东南角，距外墙1.5米', installLocation: '室内-会议室', operator: '老唐', verificationStatus: 'verified' },
    { sensorId: 'S002', siteStatement: '走廊A区东侧，现场确认设备已校准，但中途断电导致时长短', installLocation: '公共区-走廊', operator: '老唐', verificationStatus: 'needs_review' },
    { sensorId: 'S003', siteStatement: '办公区开放工位第3排', installLocation: '室内-办公区', operator: '老唐', verificationStatus: 'verified' },
    { sensorId: 'S004', siteStatement: '机房入口，采样记录丢失', installLocation: '机房入口', operator: '老唐', verificationStatus: 'needs_review' }
  ];

  beforeAll(async () => {
    uda = new UnifiedDataAccess();
    evaluationId = uda.startNewEvaluation('老唐');

    await uda.executeStep1(evaluationId, temperatureData);
    await uda.executeStep2(evaluationId, sensorData, '老唐');
    await uda.executeStep3(evaluationId, { operator: '老唐' }, '老唐');

    const list = uda.getListForDisplay(evaluationId);
    s002RecordId = list.list.find(r => r.sensorId === 'S002').id;
  });

  describe('【环节1】导入S002：采样时长15分钟 → 初始问题正确识别', () => {
    test('初始问题类型为 duration_short，缺失15分钟', () => {
      const detail = uda.getDetailForDisplay(evaluationId, s002RecordId);
      expect(detail.initialIssueDetail.type).toBe('duration_short');
      expect(detail.initialIssueDetail.missingMinutes).toBe(15);
      expect(detail.initialIssueDetail.actualMinutes).toBe(15);
      expect(detail.initialIssueDetail.description).toContain('仅15分钟');
    });

    test('6处出口中 S002 初始问题类型一致', () => {
      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const list = uda.getListForDisplay(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Api = api.data.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002List = list.list.find(r => r.sensorId === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');

      expect(s002Display.initialIssue.type).toBe('duration_short');
      expect(s002Api.initialIssue.type).toBe('duration_short');
      expect(s002Export['初始采样时间问题类型']).toBe('duration_short');
      expect(s002List.initialIssueType).toBe('duration_short');
      expect(s002History['初始问题类型']).toBe('duration_short');
      expect(s002Report.initialIssue.type).toBe('duration_short');
    });

    test('S002 初始缺失分钟数 6处出口一致为15', () => {
      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const list = uda.getListForDisplay(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Api = api.data.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002List = list.list.find(r => r.sensorId === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');

      expect(s002Display.initialIssue.missingMinutes).toBe(15);
      expect(s002Api.initialMissingMinutes).toBe(15);
      expect(s002Export['初始缺失分钟数']).toBe(15);
      expect(s002List.initialMissingMinutes).toBe(15);
      expect(s002History['初始缺失分钟数']).toBe(15);
      expect(s002Report.initialMissingMinutes).toBe(15);
    });

    test('原始说法 6处出口一致保留，没有被修改', () => {
      const expectedOriginalStatement = '走廊区域采样，中途设备断电，实际采了15分钟就结束了';

      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);
      const audit = uda.getAuditTrail(evaluationId, s002RecordId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');

      expect(s002Display.auditTrail.originalStatement).toBe(expectedOriginalStatement);
      expect(s002Export['原始说法']).toBe(expectedOriginalStatement);
      expect(s002History['原始说法']).toBe(expectedOriginalStatement);
      expect(s002Report.originalStatement).toBe(expectedOriginalStatement);
      expect(audit.originalStatement).toBe(expectedOriginalStatement);
      expect(audit.originalSnapshot.notes).toBe(expectedOriginalStatement);
    });
  });

  describe('【环节2】补录S002：时长15→30，补录后重算', () => {
    beforeAll(() => {
      uda.supplementData(
        evaluationId,
        s002RecordId,
        { sampleDurationMinutes: 30 },
        '老唐',
        '现场确认后半段数据在手持终端里，补齐全30分钟'
      );
      uda.recalculate(evaluationId);
    });

    test('补录后当前问题变为 none，但 initialIssue 仍是 duration_short', () => {
      const detail = uda.getDetailForDisplay(evaluationId, s002RecordId);
      expect(detail.currentIssue.type).toBe('none');
      expect(detail.initialIssueDetail.type).toBe('duration_short');
      expect(detail.wasEverIssue).toBe(true);
    });

    test('补录后原始说法未被修改，仍保留初始描述', () => {
      const audit = uda.getAuditTrail(evaluationId, s002RecordId);
      expect(audit.originalStatement).toBe('走廊区域采样，中途设备断电，实际采了15分钟就结束了');
      expect(audit.originalSnapshot.sampleDurationMinutes).toBe(15);
    });

    test('补录后 S002 待复核（pending），不是 approved', () => {
      const detail = uda.getDetailForDisplay(evaluationId, s002RecordId);
      expect(detail.qualityReview.status).toBe('pending');
      expect(detail.needsQualityReview).toBe(true);
      expect(detail.sourceData.nextAction).toContain('质检员');
      expect(detail.display.nextStepText).toContain('仍需质检员复核后归正常');
    });

    test('初始缺失分钟数仍为15，未被当前状态抹掉', () => {
      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const list = uda.getListForDisplay(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Api = api.data.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002List = list.list.find(r => r.sensorId === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');

      expect(s002Display.initialIssue.missingMinutes).toBe(15);
      expect(s002Api.initialMissingMinutes).toBe(15);
      expect(s002Export['初始缺失分钟数']).toBe(15);
      expect(s002List.initialMissingMinutes).toBe(15);
      expect(s002History['初始缺失分钟数']).toBe(15);
      expect(s002Report.initialMissingMinutes).toBe(15);
    });

    test('导出明细下一步处理不是"已完成"，是待复核', () => {
      const exportData = uda.getResultsForExport(evaluationId);
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      expect(s002Export['下一步处理']).not.toBe('已完成');
      expect(s002Export['下一步处理']).toContain('需质检员');
      expect(s002Export['下一步处理']).toContain('归正常');
    });

    test('改后值、处理原因、责任人 正确保留并6处一致', () => {
      const expectedCorrectedField = 'sampleDurationMinutes';
      const expectedOld = '15';
      const expectedNew = '30';
      const expectedReason = '现场确认后半段数据在手持终端里，补齐全30分钟';
      const expectedOperator = '老唐';

      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);
      const audit = uda.getAuditTrail(evaluationId, s002RecordId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');
      const change = s002Display.manualChanges[0];

      expect(change.field).toBe(expectedCorrectedField);
      expect(change.oldValue).toBe(expectedOld);
      expect(change.newValue).toBe(expectedNew);
      expect(change.reason).toBe(expectedReason);
      expect(change.operator).toBe(expectedOperator);

      expect(s002Export['改后值明细']).toContain('sampleDurationMinutes');
      expect(s002Export['处理原因明细']).toContain(expectedReason);
      expect(s002Export['责任人明细']).toBe(expectedOperator);

      expect(s002Report.corrections[0].originalValue).toBe(expectedOld);
      expect(s002Report.corrections[0].correctedValue).toBe(expectedNew);
      expect(s002Report.corrections[0].reason).toBe(expectedReason);
      expect(s002Report.corrections[0].operator).toBe(expectedOperator);

      expect(audit.manualChanges[0].originalValue).toBe(expectedOld);
      expect(audit.manualChanges[0].correctedValue).toBe(expectedNew);
      expect(audit.manualChanges[0].processingReason).toBe(expectedReason);
      expect(audit.manualChanges[0].operator).toBe(expectedOperator);
    });

    test('S002 不纳入正常结果，报告中明确为"否"', () => {
      const report = uda.getReport(evaluationId);
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');
      expect(s002Report.isInNormalResults).toBe(false);
      const s002InReportRecords = report.records.find(r => r['传感器编号'] === 'S002');
      expect(s002InReportRecords['是否纳入正常结果']).toBe('否');
    });

    test('列表和接口仍显示为待复核状态，不是正常通过', () => {
      const list = uda.getListForDisplay(evaluationId);
      const s002List = list.list.find(r => r.sensorId === 'S002');
      expect(s002List.needsReview).toBe(true);
      expect(s002List.displayBadge).toBe('待复核');
      expect(s002List.nextStep).toContain('仍需质检员复核');
      expect(s002List.initialBadge).toContain('15分钟');
      expect(s002List.initialBadge).toContain('缺15分钟');
    });
  });

  describe('【环节3】质检员复核通过 S002', () => {
    beforeAll(() => {
      uda.qualityReview(
        evaluationId,
        s002RecordId,
        '质检员A',
        'approve',
        '已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信'
      );
    });

    test('复核通过后原始说法仍未被污染', () => {
      const audit = uda.getAuditTrail(evaluationId, s002RecordId);
      expect(audit.originalStatement).toBe('走廊区域采样，中途设备断电，实际采了15分钟就结束了');
    });

    test('复核备注单独保存在 qualityReview.reviewNotes，不是追加到原始说法', () => {
      const detail = uda.getDetailForDisplay(evaluationId, s002RecordId);
      const expectedNote = '已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信';
      expect(detail.sourceData.reviewNotes).toBe(expectedNote);
      expect(detail.qualityReview.reviewNotes).toBe(expectedNote);
      expect(detail.auditTrail.qualityReview.reviewNotes).toBe(expectedNote);
      expect(detail.sourceData.originalStatement).not.toContain('已核对手持终端');
    });

    test('初始问题证据仍在：duration_short，缺15分钟', () => {
      const display = uda.getResultsForDisplay(evaluationId);
      const api = uda.getResultsForAPI(evaluationId);
      const exportData = uda.getResultsForExport(evaluationId);
      const list = uda.getListForDisplay(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);

      const s002Display = display.records.find(r => r.sensorId === 'S002');
      const s002Api = api.data.records.find(r => r.sensorId === 'S002');
      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002List = list.list.find(r => r.sensorId === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002Report = report.recordAudits.find(r => r.sensorId === 'S002');

      expect(s002Display.initialIssue.type).toBe('duration_short');
      expect(s002Api.initialIssue.type).toBe('duration_short');
      expect(s002Export['初始采样时间问题类型']).toBe('duration_short');
      expect(s002List.initialIssueType).toBe('duration_short');
      expect(s002History['初始问题类型']).toBe('duration_short');
      expect(s002Report.initialIssue.type).toBe('duration_short');

      expect(s002Display.initialIssue.missingMinutes).toBe(15);
      expect(s002Api.initialMissingMinutes).toBe(15);
      expect(s002Export['初始缺失分钟数']).toBe(15);
      expect(s002List.initialMissingMinutes).toBe(15);
      expect(s002History['初始缺失分钟数']).toBe(15);
      expect(s002Report.initialMissingMinutes).toBe(15);
    });

    test('审计内容分开保存：原始说法、改后值、处理原因、责任人 各自独立字段', () => {
      const audit = uda.getAuditTrail(evaluationId, s002RecordId);

      expect(audit.originalStatement).toBe('走廊区域采样，中途设备断电，实际采了15分钟就结束了');
      expect(audit.manualChanges[0].correctedValue).toBe('30');
      expect(audit.manualChanges[0].processingReason).toBe('现场确认后半段数据在手持终端里，补齐全30分钟');
      expect(audit.manualChanges[0].operator).toBe('老唐');
      expect(audit.qualityReview.reviewer).toBe('质检员A');
      expect(audit.qualityReview.decision).toBe('approve');
      expect(audit.qualityReview.reviewNotes).toBe('已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信');
      expect(audit.qualityReview.currentNextStep).toBe('已通过质检员复核，可纳入正常结果');
    });

    test('报告已纳入正常结果，但保留初始异常记录', () => {
      const report = uda.getReport(evaluationId);
      const s002ReportAudit = report.recordAudits.find(r => r.sensorId === 'S002');
      const s002InRecords = report.records.find(r => r['传感器编号'] === 'S002');

      expect(s002ReportAudit.isInNormalResults).toBe(true);
      expect(s002InRecords['是否纳入正常结果']).toBe('是');
      expect(s002InRecords['是否曾有异常']).toBe('是');
      expect(s002InRecords['初始问题描述']).toContain('15分钟');
      expect(s002InRecords['初始缺失分钟数']).toBe(15);
      expect(s002InRecords['证据链_原始说法']).toBe('走廊区域采样，中途设备断电，实际采了15分钟就结束了');
      expect(s002InRecords['证据链_复核备注']).toBe('已核对手持终端的后半段数据，时长确实补齐到30分钟，数据可信');
    });
  });

  describe('【环节4】6处出口一致性校验（S002 全状态）', () => {
    test('verifyDataConsistency 返回完全一致', () => {
      const result = uda.verifyDataConsistency(evaluationId);
      expect(result.isConsistent).toBe(true);
      expect(result.summary.totalSourcesVerified).toBe(6);
      expect(result.checks.recordCount.consistent).toBe(true);
      expect(result.checks.recordsEverHadIssue.consistent).toBe(true);
      expect(result.checks.qualityReviewCount.consistent).toBe(true);
      expect(result.sampleFieldConsistency.sourceLine.consistent).toBe(true);
      expect(result.sampleFieldConsistency.sensorId.consistent).toBe(true);
      expect(result.sampleFieldConsistency.initialMissingMinutes.consistent).toBe(true);
    });

    test('S002 在导出/历史/报告中 wasEverIssue = 是', () => {
      const exportData = uda.getResultsForExport(evaluationId);
      const history = uda.getHistoryForDisplay(evaluationId);
      const report = uda.getReport(evaluationId);

      const s002Export = exportData.details.find(r => r['传感器编号'] === 'S002');
      const s002History = history.history.find(h => h['传感器编号'] === 'S002');
      const s002InRecords = report.records.find(r => r['传感器编号'] === 'S002');

      expect(s002Export['采样时间曾有异常']).toBe('是');
      expect(s002History['是否曾有异常']).toBe('是');
      expect(s002InRecords['是否曾有异常']).toBe('是');
    });

    test('6处出口 S001 原始行号一致（行号2，S001第一条）', () => {
      const consistency = uda.verifyDataConsistency(evaluationId);
      expect(consistency.sampleFieldConsistency.sourceLine.consistent).toBe(true);
      expect(consistency.sampleFieldConsistency.sourceLine.list).toBe(2);
    });
  });

  describe('三步工作流 + 自检', () => {
    test('自检：duplicateImport/recalculation/exportConsistency 通过，missingSampleTime 仍未通过（因S004为空）', () => {
      const api = uda.getResultsForAPI(evaluationId);
      const selfCheck = api.data.selfCheck;
      expect(selfCheck.duplicateImport.passed).toBe(true);
      expect(selfCheck.missingSampleTime.passed).toBe(false);
      expect(selfCheck.missingSampleTime.count).toBe(1);
      const s004Missing = selfCheck.missingSampleTime.details.find(d => d.sensorId === 'S004');
      expect(s004Missing).toBeDefined();
      expect(s004Missing.currentIssueType).toBe('empty');
      expect(selfCheck.recalculationAfterSupplement.passed).toBe(true);
      expect(selfCheck.exportConsistency.passed).toBe(true);
    });

    test('自检补录重算：S002 有补录记录，初始缺15分钟', () => {
      const api = uda.getResultsForAPI(evaluationId);
      const s002Check = api.data.selfCheck.recalculationAfterSupplement.details.find(d => d.sensorId === 'S002');
      expect(s002Check.initialMissingMinutes).toBe(15);
      expect(s002Check.supplemented).toBe(true);
      expect(s002Check.changes.length).toBeGreaterThan(0);
      expect(s002Check.changes[0].from).toBe('15');
      expect(s002Check.changes[0].to).toBe('30');
    });
  });
});
