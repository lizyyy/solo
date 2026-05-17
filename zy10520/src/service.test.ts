import { pollutionService } from './service';
import { PollutionStatus, PollutionRuleType } from './types';

describe('PollutionService', () => {
  const mockCreateRequest = {
    experimentId: 'EXP-001',
    experimentName: '按钮颜色AB实验',
    createdBy: 'user-123',
    pollutionRules: [{
      type: PollutionRuleType.INTERNAL_ACCOUNT,
      name: '内部员工账号',
      description: '排除公司内部员工账号',
      conditions: { emailDomain: 'company.com' },
      createdBy: 'user-123'
    }],
    sampleUsers: [
      { userId: 'user-001', userType: 'INTERNAL', originalGroup: 'A', attributes: { email: 'user1@company.com' } },
      { userId: 'user-002', userType: 'EXTERNAL', originalGroup: 'A', attributes: { email: 'user2@gmail.com' } },
      { userId: 'user-003', userType: 'INTERNAL', originalGroup: 'B', attributes: { email: 'user3@company.com' } },
      { userId: 'user-004', userType: 'EXTERNAL', originalGroup: 'B', attributes: { email: 'user4@gmail.com' } }
    ],
    remarks: '发现内部员工混入样本'
  };

  describe('正常流程测试', () => {
    it('1. 创建污染记录', () => {
      const result = pollutionService.createPollution(mockCreateRequest);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.experimentId).toBe('EXP-001');
      expect(result.status).toBe(PollutionStatus.CREATED);
      expect(result.pollutionRules.length).toBe(1);
      expect(result.sampleUsers.length).toBe(4);
      expect(result.operationLogs.length).toBe(1);
      expect(result.operationLogs[0].operation).toBe('CREATE');
    });

    it('2. 查询记录详情', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      const found = pollutionService.getById(created.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.experimentId).toBe('EXP-001');
    });

    it('3. 查询记录列表', () => {
      pollutionService.createPollution(mockCreateRequest);
      const result = pollutionService.query({});
      
      expect(result.total).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('4. 状态流转 - 污染识别', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '系统检测到内部员工账号',
        payload: { pollutedUserIds: ['user-001', 'user-003'] }
      });

      expect(result.status).toBe(PollutionStatus.IDENTIFIED);
      expect(result.sampleUsers.find(u => u.userId === 'user-001')?.isPolluted).toBe(true);
      expect(result.sampleUsers.find(u => u.userId === 'user-002')?.isPolluted).toBe(false);
    });

    it('5. 状态流转 - 标记样本', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '系统检测到内部员工账号'
      });
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.SAMPLES_MARKED,
        operator: 'user-456',
        processingBasis: '确认标记污染样本已标记'
      });

      expect(result.status).toBe(PollutionStatus.SAMPLES_MARKED);
    });

    it('6. 状态流转 - 影响重算', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IDENTIFIED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.SAMPLES_MARKED, operator: 'user-456', processingBasis: 'test' });
      
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IMPACT_RECALCULATED,
        operator: 'user-456',
        processingBasis: '重新计算指标影响',
        payload: {
          metricImpacts: [
            { metricName: '点击率', originalValue: 0.12, cleanedValue: 0.08, changeRate: -0.333, confidenceLevel: 0.95, statisticalSignificance: true },
            { metricName: '转化率', originalValue: 0.05, cleanedValue: 0.04, changeRate: -0.2, confidenceLevel: 0.90, statisticalSignificance: false }
          ]
        }
      });

      expect(result.status).toBe(PollutionStatus.IMPACT_RECALCULATED);
      expect(result.metricImpacts.length).toBe(2);
    });

    it('7. 状态流转 - 提交复核', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IDENTIFIED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.SAMPLES_MARKED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IMPACT_RECALCULATED, operator: 'user-456', processingBasis: 'test' });
      
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.REVIEW_REQUESTED,
        operator: 'user-456',
        processingBasis: '提交剔除申请',
        payload: {
          exclusionApplication: {
            applicant: 'user-456',
            reason: '内部员工账号污染样本',
            expectedImpact: '点击率下降33%'
          }
        }
      });

      expect(result.status).toBe(PollutionStatus.REVIEW_REQUESTED);
      expect(result.exclusionApplication).toBeDefined();
    });

    it('8. 状态流转 - 复核通过', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IDENTIFIED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.SAMPLES_MARKED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IMPACT_RECALCULATED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.REVIEW_REQUESTED, operator: 'user-456', processingBasis: 'test' });
      
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.REVIEW_APPROVED,
        operator: 'reviewer-789',
        processingBasis: '复核通过，确认污染处理',
        payload: {
          reviewReport: {
            reviewer: 'reviewer-789',
            reviewComment: '确认污染样本处理合理，影响计算正确',
            reviewResult: 'APPROVED',
            attachments: []
          }
        }
      });

      expect(result.status).toBe(PollutionStatus.REVIEW_APPROVED);
      expect(result.reviewReports.length).toBe(1);
    });

    it('9. 状态流转 - 完成', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IDENTIFIED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.SAMPLES_MARKED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.IMPACT_RECALCULATED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.REVIEW_REQUESTED, operator: 'user-456', processingBasis: 'test' });
      pollutionService.updateStatus({ recordId: created.id, targetStatus: PollutionStatus.REVIEW_APPROVED, operator: 'reviewer-789', processingBasis: 'test' });
      
      const result = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.COMPLETED,
        operator: 'user-456',
        processingBasis: '流程完成'
      });

      expect(result.status).toBe(PollutionStatus.COMPLETED);
    });

    it('10. 导出数据', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      const result = pollutionService.export({
        recordId: created.id,
        format: 'JSON',
        includeSections: ['BASIC', 'SAMPLES', 'IMPACT', 'REVIEW', 'LOGS']
      });

      expect(result.basic).toBeDefined();
      expect(result.sampleUsers).toBeDefined();
      expect(result.operationLogs).toBeDefined();
    });
  });

  describe('幂等性测试', () => {
    it('重复提交相同状态不会重复推进', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      const logCountBefore = created.operationLogs.length;

      const result1 = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '第一次提交'
      });
      const logCountAfterFirst = result1.operationLogs.length;
      expect(result1.status).toBe(PollutionStatus.IDENTIFIED);

      const result2 = pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '重复提交'
      });

      expect(result2.status).toBe(PollutionStatus.IDENTIFIED);
      expect(result2.operationLogs.length).toBe(logCountAfterFirst + 1);
      
      const idempotentLog = result2.operationLogs.find(log => log.operation === 'STATUS_UPDATE_IDEMPOTENT');
      expect(idempotentLog).toBeDefined();
    });

    it('重复提交不会产生重复的操作记录', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      
      pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: 'test'
      });
      
      const statusAfterFirst = pollutionService.getById(created.id);
      const logCountAfterFirst = statusAfterFirst?.operationLogs.length || 0;
      
      pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '重复提交1'
      });
      
      pollutionService.updateStatus({
        recordId: created.id,
        targetStatus: PollutionStatus.IDENTIFIED,
        operator: 'user-456',
        processingBasis: '重复提交2'
      });

      const final = pollutionService.getById(created.id);
      expect(final?.status).toBe(PollutionStatus.IDENTIFIED);
      expect(final?.operationLogs.length).toBe(logCountAfterFirst + 2);
    });
  });

  describe('异常处理测试', () => {
    it('非法状态流转应该抛出错误', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      
      expect(() => {
        pollutionService.updateStatus({
          recordId: created.id,
          targetStatus: PollutionStatus.COMPLETED,
          operator: 'user-456',
          processingBasis: '直接完成，跳过中间状态'
        });
      }).toThrow('Invalid status transition');

      const record = pollutionService.getById(created.id);
      const errorLog = record?.operationLogs.find(log => log.operation === 'STATUS_UPDATE_FAILED');
      expect(errorLog).toBeDefined();
      expect(errorLog?.errorMessage).toBeDefined();
    });

    it('人工修正应该记录操作日志', () => {
      const created = pollutionService.createPollution(mockCreateRequest);
      
      const result = pollutionService.manualCorrection({
        recordId: created.id,
        operator: 'admin-001',
        correctionType: 'SAMPLE_USER',
        originalValue: { userId: 'user-001' },
        newValue: { isPolluted: false },
        reason: '用户已离职，不再属于内部员工'
      });

      expect(result.sampleUsers.find(u => u.userId === 'user-001')?.isPolluted).toBe(false);
      const correctionLog = result.operationLogs.find(log => log.operation === 'MANUAL_CORRECTION');
      expect(correctionLog).toBeDefined();
    });
  });
});
