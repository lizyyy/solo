import { RefundService, CreateRefundRequest } from '../src/services/RefundService';
import { ChargingSessionRepository } from '../src/repositories/ChargingSessionRepository';
import { BillingSegmentRepository } from '../src/repositories/BillingSegmentRepository';
import { RefundRepository } from '../src/repositories/RefundRepository';
import { initializeDb, getDb, closeDb } from '../src/database';
import {
  RefundStatus,
  RejectStage,
  InterruptionReason,
  ChargeType,
} from '../src/types';
import { v4 as uuidv4 } from 'uuid';

describe('RefundService (Integration Tests)', () => {
  let service: RefundService;
  let sessionRepo: ChargingSessionRepository;
  let segmentRepo: BillingSegmentRepository;
  let refundRepo: RefundRepository;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.run('DELETE FROM refund_history');
    db.run('DELETE FROM refund_records');
    db.run('DELETE FROM refund_requests');
    db.run('DELETE FROM billing_segments');
    db.run('DELETE FROM charging_sessions');
    
    sessionRepo = new ChargingSessionRepository();
    segmentRepo = new BillingSegmentRepository();
    refundRepo = new RefundRepository();
    service = new RefundService(sessionRepo, segmentRepo, refundRepo);
  });

  afterAll(() => {
    closeDb();
  });

  function createTestSession(
    status: 'INTERRUPTED' | 'COMPLETED' | 'ACTIVE' = 'INTERRUPTED',
    overrides: Partial<{ energyAmount: number; serviceAmount: number; isRefundable: boolean }> = {}
  ): string {
    const session = sessionRepo.create({
      userId: 'user-test-1',
      stationId: 'station-test-1',
      connectorId: 'conn-test-1',
      chargeType: ChargeType.FAST,
      startTime: threeHoursAgo,
      endTime: status === 'ACTIVE' ? null : oneHourAgo,
      totalRequestedKwh: 100,
      status,
    });

    const energyAmount = overrides.energyAmount ?? 66;
    const serviceAmount = overrides.serviceAmount ?? 10;
    const isRefundable = overrides.isRefundable ?? true;

    if (energyAmount > 0) {
      segmentRepo.create({
        sessionId: session.id,
        segmentType: 'ENERGY',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        actualKwh: 50,
        rateId: 'rate-test',
        unitPrice: 1.32,
        amount: energyAmount,
        isRefundable,
        refundPercentage: 100,
      });
    }

    if (serviceAmount > 0) {
      segmentRepo.create({
        sessionId: session.id,
        segmentType: 'SERVICE',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        actualKwh: 0,
        rateId: 'rate-test',
        unitPrice: 0,
        amount: serviceAmount,
        isRefundable,
        refundPercentage: 100,
      });
    }

    return session.id;
  }

  describe('createRefundRequest', () => {
    test('正常创建退款请求 - 设备故障应全额退款', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const request: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
        description: '设备故障',
      };

      const result = service.createRefundRequest(request);

      expect(result.success).toBe(true);
      expect(result.refundRecord).toBeDefined();
      expect(result.refundRecord?.status).toBe(RefundStatus.CALCULATED);
      expect(result.refundRecord?.currentStage).toBeNull();
      expect(result.refundRecord?.energyRefundAmount).toBe(66);
      expect(result.refundRecord?.serviceRefundAmount).toBe(10);
      expect(result.refundRecord?.totalRefundAmount).toBe(76);
    });

    test('幂等性测试 - 相同 requestId 应返回已存在的记录', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const request: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      const result1 = service.createRefundRequest(request);
      const result2 = service.createRefundRequest(request);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.message).toContain('幂等');
      expect(result1.refundRecord?.id).toBe(result2.refundRecord?.id);
    });

    test('车辆问题应无退款金额并自动拒绝', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const request: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.VEHICLE_ISSUE,
        interruptionTime: oneHourAgo,
      };

      const result = service.createRefundRequest(request);

      expect(result.success).toBe(false);
      expect(result.currentStage).toBe(RejectStage.CALCULATION);
      expect(result.message).toContain('自动拒绝');
    });

    test('会话不存在应在验证阶段失败', () => {
      const request: CreateRefundRequest = {
        requestId: `REQ-${uuidv4()}`,
        sessionId: 'non-existent-session',
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      const result = service.createRefundRequest(request);

      expect(result.success).toBe(false);
      expect(result.currentStage).toBe(RejectStage.VALIDATION);
      expect(result.message).toContain('会话不存在');
    });

    test('已完成的会话不应接受退款请求', () => {
      const sessionId = createTestSession('COMPLETED');
      const request: CreateRefundRequest = {
        requestId: `REQ-${uuidv4()}`,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      const result = service.createRefundRequest(request);

      expect(result.success).toBe(false);
      expect(result.currentStage).toBe(RejectStage.VALIDATION);
      expect(result.message).toContain('已正常完成');
    });

    test('正在进行的会话不应接受退款请求', () => {
      const sessionId = createTestSession('ACTIVE');
      const request: CreateRefundRequest = {
        requestId: `REQ-${uuidv4()}`,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      const result = service.createRefundRequest(request);

      expect(result.success).toBe(false);
      expect(result.currentStage).toBe(RejectStage.VALIDATION);
      expect(result.message).toContain('仍在进行');
    });
  });

  describe('完整流程测试', () => {
    test('完整正常流程应成功完成', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      let result = service.createRefundRequest(createRequest);
      expect(result.refundRecord?.status).toBe(RefundStatus.CALCULATED);

      result = service.approveRefund(requestId);
      expect(result.refundRecord?.status).toBe(RefundStatus.APPROVED);

      result = service.sendCallback(requestId, '{"status":"success"}');
      expect(result.refundRecord?.status).toBe(RefundStatus.CALLBACK_SENT);
      expect(result.refundRecord?.callbackCount).toBe(1);

      result = service.reconcile(requestId, true);
      expect(result.refundRecord?.status).toBe(RefundStatus.RECONCILED);

      result = service.complete(requestId);
      expect(result.refundRecord?.status).toBe(RefundStatus.COMPLETED);
    });

    test('对账失败应在对账阶段拒绝', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);
      service.approveRefund(requestId);
      service.sendCallback(requestId);

      const result = service.reconcile(requestId, false);

      expect(result.success).toBe(false);
      expect(result.refundRecord?.status).toBe(RefundStatus.REJECTED);
      expect(result.currentStage).toBe(RejectStage.RECONCILIATION);
    });
  });

  describe('回调幂等和重试测试', () => {
    test('多次回调应幂等返回', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);
      service.approveRefund(requestId);

      const result1 = service.sendCallback(requestId);
      const result2 = service.sendCallback(requestId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.message).toContain('幂等');
      expect(result1.refundRecord?.callbackCount).toBe(1);
      expect(result2.refundRecord?.callbackCount).toBe(1);
    });

    test('回调次数超过3次应自动拒绝', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);
      service.approveRefund(requestId);

      let record = service.getRefundDetail(requestId);
      if (record?.record) {
        record.record.callbackCount = 3;
        refundRepo.updateRecord(record.record);
      }

      const result = service.sendCallback(requestId);

      expect(result.success).toBe(false);
      expect(result.refundRecord?.status).toBe(RefundStatus.REJECTED);
      expect(result.currentStage).toBe(RejectStage.CALLBACK);
      expect(result.message).toContain('超过3次');
    });
  });

  describe('状态查询和历史记录', () => {
    test('查询退款详情应包含完整信息', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);

      const detail = service.getRefundDetail(requestId);

      expect(detail).not.toBeNull();
      expect(detail?.record).toBeDefined();
      expect(detail?.request).toBeDefined();
      expect(detail?.session).toBeDefined();
      expect(detail?.segments).toHaveLength(2);
      expect(detail?.history).toHaveLength(1);
      expect(detail?.latestHistory).toBeDefined();
    });

    test('多次操作后应能查询历史记录', async () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.EQUIPMENT_FAULT,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);
      await new Promise(resolve => setTimeout(resolve, 5));
      service.approveRefund(requestId);
      await new Promise(resolve => setTimeout(resolve, 5));
      service.sendCallback(requestId);

      const detail = service.getRefundDetail(requestId);

      expect(detail?.history).toHaveLength(3);
      expect(detail?.latestHistory?.status).toBe(RefundStatus.CALLBACK_SENT);
      expect(detail?.previousHistory?.status).toBe(RefundStatus.APPROVED);
    });

    test('已拒绝状态应能查询卡点和历史', () => {
      const sessionId = createTestSession('INTERRUPTED');
      const requestId = `REQ-${uuidv4()}`;

      const createRequest: CreateRefundRequest = {
        requestId,
        sessionId,
        interruptionReason: InterruptionReason.VEHICLE_ISSUE,
        interruptionTime: oneHourAgo,
      };

      service.createRefundRequest(createRequest);

      const detail = service.getRefundDetail(requestId);

      expect(detail?.record.status).toBe(RefundStatus.REJECTED);
      expect(detail?.record.currentStage).toBe(RejectStage.CALCULATION);
      expect(detail?.latestHistory?.stage).toBe(RejectStage.CALCULATION);
    });
  });
});
