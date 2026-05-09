import { DatabaseService } from '../src/database/database';
import { InvitationService } from '../src/services/invitationService';
import {
  InvitationBatchStatus,
  EnrollmentStatus,
  SettlementStatus
} from '../src/types';

describe('InvitationService - Full Workflow', () => {
  let db: DatabaseService;
  let service: InvitationService;

  beforeEach(async () => {
    db = await DatabaseService.create(':memory:');
    service = new InvitationService(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestBatch = () => {
    const now = new Date();
    return {
      name: '2024年夏季削峰邀约',
      description: '针对夏季用电高峰的削峰需求响应邀约',
      targetPeakLoad: 1000,
      unitPrice: 0.8,
      enrollmentStartTime: new Date(now.getTime() + 86400000),
      enrollmentEndTime: new Date(now.getTime() + 172800000),
      executionStartTime: new Date(now.getTime() + 259200000),
      executionEndTime: new Date(now.getTime() + 345600000)
    };
  };

  describe('Batch Lifecycle', () => {
    it('should create a batch in DRAFT status', () => {
      const input = createTestBatch();
      const result = service.createBatch(input);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(InvitationBatchStatus.DRAFT);
      expect(result.data?.version).toBe(1);
    });

    it('should validate batch creation inputs', () => {
      const input = createTestBatch();
      
      const invalidInput = { ...input, targetPeakLoad: -100 };
      const result = service.createBatch(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_TARGET_PEAK_LOAD');
    });

    it('should transition batch through full lifecycle', () => {
      const input = createTestBatch();
      const createResult = service.createBatch(input);
      const batchId = createResult.data!.id;

      const publishResult = service.publishBatch(batchId);
      expect(publishResult.success).toBe(true);
      expect(publishResult.data?.status).toBe(InvitationBatchStatus.PUBLISHED);

      const startEnrollmentResult = service.startEnrollment(batchId);
      expect(startEnrollmentResult.success).toBe(true);
      expect(startEnrollmentResult.data?.status).toBe(InvitationBatchStatus.ENROLLMENT_STARTED);

      const closeEnrollmentResult = service.closeEnrollment(batchId);
      expect(closeEnrollmentResult.success).toBe(true);
      expect(closeEnrollmentResult.data?.status).toBe(InvitationBatchStatus.ENROLLMENT_CLOSED);

      const startExecutionResult = service.startExecution(batchId);
      expect(startExecutionResult.success).toBe(true);
      expect(startExecutionResult.data?.status).toBe(InvitationBatchStatus.EXECUTION_STARTED);

      const completeExecutionResult = service.completeExecution(batchId);
      expect(completeExecutionResult.success).toBe(true);
      expect(completeExecutionResult.data?.status).toBe(InvitationBatchStatus.EXECUTION_COMPLETED);

      const startSettlementResult = service.startSettlement(batchId);
      expect(startSettlementResult.success).toBe(true);
      expect(startSettlementResult.data?.status).toBe(InvitationBatchStatus.SETTLEMENT_STARTED);

      const completeSettlementResult = service.completeSettlement(batchId);
      expect(completeSettlementResult.success).toBe(true);
      expect(completeSettlementResult.data?.status).toBe(InvitationBatchStatus.SETTLEMENT_COMPLETED);
    });

    it('should reject invalid state transitions', () => {
      const input = createTestBatch();
      const createResult = service.createBatch(input);
      const batchId = createResult.data!.id;

      const invalidResult = service.startEnrollment(batchId);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error?.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('Enrollment Workflow', () => {
    it('should prevent enrollment before enrollment starts', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);

      const enrollmentResult = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });

      expect(enrollmentResult.success).toBe(false);
      expect(enrollmentResult.error?.code).toBe('ENROLLMENT_NOT_OPEN');
    });

    it('should prevent duplicate enrollment for same enterprise', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const firstEnrollment = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });
      expect(firstEnrollment.success).toBe(true);

      const duplicateEnrollment = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A（重复）',
        declaredCapacity: 300,
        contactName: '李四',
        contactPhone: '13900139000'
      });

      expect(duplicateEnrollment.success).toBe(false);
      expect(duplicateEnrollment.error?.code).toBe('DUPLICATE_ENROLLMENT');
    });

    it('should review enrollment', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const enrollmentResult = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });
      const enrollmentId = enrollmentResult.data!.id;

      const approveResult = service.reviewEnrollment({
        enrollmentId,
        approved: true,
        reviewComment: '审核通过，容量合理',
        operator: '管理员'
      });

      expect(approveResult.success).toBe(true);
      expect(approveResult.data?.status).toBe(EnrollmentStatus.APPROVED);
      expect(approveResult.data?.reviewComment).toBe('审核通过，容量合理');
    });

    it('should reject enrollment review in wrong status', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const enrollmentResult = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });
      const enrollmentId = enrollmentResult.data!.id;

      service.reviewEnrollment({
        enrollmentId,
        approved: true,
        operator: '管理员'
      });

      const doubleApprove = service.reviewEnrollment({
        enrollmentId,
        approved: false,
        operator: '管理员'
      });

      expect(doubleApprove.success).toBe(false);
    });
  });

  describe('Execution and Settlement', () => {
    it('should prevent execution record submission before execution starts', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const enrollmentResult = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });
      const enrollmentId = enrollmentResult.data!.id;

      service.reviewEnrollment({
        enrollmentId,
        approved: true,
        operator: '管理员'
      });

      const executionResult = service.submitExecutionRecord({
        batchId,
        enrollmentId,
        enterpriseId: 'ent-001',
        timestamp: new Date(),
        baselineLoad: 1000,
        actualLoad: 800,
        sourceSystem: 'smart-meter'
      });

      expect(executionResult.success).toBe(false);
      expect(executionResult.error?.code).toBe('EXECUTION_NOT_ACTIVE');
    });

    it('should calculate deviation and settlement correctly', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const enrollmentResult = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '测试企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });
      const enrollmentId = enrollmentResult.data!.id;

      service.reviewEnrollment({
        enrollmentId,
        approved: true,
        operator: '管理员'
      });

      service.closeEnrollment(batchId);
      service.startExecution(batchId);

      service.submitExecutionRecord({
        batchId,
        enrollmentId,
        enterpriseId: 'ent-001',
        timestamp: new Date(),
        baselineLoad: 1000,
        actualLoad: 820,
        sourceSystem: 'smart-meter'
      });

      service.submitExecutionRecord({
        batchId,
        enrollmentId,
        enterpriseId: 'ent-001',
        timestamp: new Date(),
        baselineLoad: 1000,
        actualLoad: 780,
        sourceSystem: 'smart-meter'
      });

      const deviationResult = service.calculateDeviationForEnrollment(enrollmentId);
      expect(deviationResult.success).toBe(true);
      const devData = deviationResult.data;
      expect(devData).toBeDefined();
      expect(devData?.deviationResult?.achievedReduction).toBe(200);
      expect(devData?.deviationResult?.deviationRate).toBe(1);
      expect(devData?.deviationResult?.isPassed).toBe(true);

      const settlementResult = service.calculateSettlementForEnrollment(enrollmentId);
      expect(settlementResult.success).toBe(true);
      expect(settlementResult.data?.status).toBe(SettlementStatus.COMPLETED);
      expect(settlementResult.data?.settlementAmount).toBe(160);
    });
  });

  describe('Events and Audit Trail', () => {
    it('should record events for state changes', () => {
      const input = createTestBatch();
      const createResult = service.createBatch(input, '系统管理员');
      const batchId = createResult.data!.id;

      service.publishBatch(batchId, '运营专员');

      const events = service.getEventsByBatch(batchId);
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe('create');
      expect(events[1].eventType).toBe('publish');
    });
  });

  describe('Batch Summary', () => {
    it('should generate comprehensive batch summary', () => {
      const batchInput = createTestBatch();
      const batchResult = service.createBatch(batchInput);
      const batchId = batchResult.data!.id;

      service.publishBatch(batchId);
      service.startEnrollment(batchId);

      const enrollment1 = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-001',
        enterpriseName: '企业A',
        declaredCapacity: 200,
        contactName: '张三',
        contactPhone: '13800138000'
      });

      const enrollment2 = service.createEnrollment({
        batchId,
        enterpriseId: 'ent-002',
        enterpriseName: '企业B',
        declaredCapacity: 300,
        contactName: '李四',
        contactPhone: '13900139000'
      });

      service.reviewEnrollment({
        enrollmentId: enrollment1.data!.id,
        approved: true,
        operator: '管理员'
      });

      service.reviewEnrollment({
        enrollmentId: enrollment2.data!.id,
        approved: false,
        reviewComment: '申报容量过大',
        operator: '管理员'
      });

      const summary = service.getBatchSummary(batchId);
      expect(summary.success).toBe(true);
      expect(summary.data?.enrollments.length).toBe(2);
      expect(summary.data?.eventTimeline.length).toBeGreaterThan(0);
    });
  });
});
