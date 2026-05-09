import { RefundCalculationService, DefaultRefundPolicy } from '../src/services/RefundCalculationService';
import { InterruptionReason, BillingSegment } from '../src/types';

describe('RefundCalculationService', () => {
  let service: RefundCalculationService;
  let policy: DefaultRefundPolicy;

  beforeEach(() => {
    policy = new DefaultRefundPolicy();
    service = new RefundCalculationService(policy);
  });

  describe('DefaultRefundPolicy', () => {
    describe('getRefundPercentage', () => {
      test('设备故障应100%退款电量和服务费', () => {
        const energyPct = policy.getRefundPercentage(InterruptionReason.EQUIPMENT_FAULT, 'ENERGY');
        const servicePct = policy.getRefundPercentage(InterruptionReason.EQUIPMENT_FAULT, 'SERVICE');
        
        expect(energyPct).toBe(100);
        expect(servicePct).toBe(100);
      });

      test('网络中断应100%退款电量和服务费', () => {
        const energyPct = policy.getRefundPercentage(InterruptionReason.NETWORK_DISCONNECT, 'ENERGY');
        const servicePct = policy.getRefundPercentage(InterruptionReason.NETWORK_DISCONNECT, 'SERVICE');
        
        expect(energyPct).toBe(100);
        expect(servicePct).toBe(100);
      });

      test('用户主动停止应50%退款电量和服务费', () => {
        const energyPct = policy.getRefundPercentage(InterruptionReason.USER_STOP, 'ENERGY');
        const servicePct = policy.getRefundPercentage(InterruptionReason.USER_STOP, 'SERVICE');
        
        expect(energyPct).toBe(50);
        expect(servicePct).toBe(50);
      });

      test('车辆问题应0%退款', () => {
        const energyPct = policy.getRefundPercentage(InterruptionReason.VEHICLE_ISSUE, 'ENERGY');
        const servicePct = policy.getRefundPercentage(InterruptionReason.VEHICLE_ISSUE, 'SERVICE');
        
        expect(energyPct).toBe(0);
        expect(servicePct).toBe(0);
      });
    });

    describe('isRefundable', () => {
      test('设备故障应该可退款', () => {
        expect(policy.isRefundable(InterruptionReason.EQUIPMENT_FAULT, 'ENERGY')).toBe(true);
        expect(policy.isRefundable(InterruptionReason.EQUIPMENT_FAULT, 'SERVICE')).toBe(true);
      });

      test('车辆问题不可退款', () => {
        expect(policy.isRefundable(InterruptionReason.VEHICLE_ISSUE, 'ENERGY')).toBe(false);
        expect(policy.isRefundable(InterruptionReason.VEHICLE_ISSUE, 'SERVICE')).toBe(false);
      });
    });
  });

  describe('calculateRefund', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const createSegment = (overrides: Partial<BillingSegment> = {}): BillingSegment => ({
      id: 'seg-1',
      sessionId: 'session-1',
      segmentType: 'ENERGY',
      startTime: twoHoursAgo,
      endTime: oneHourAgo,
      actualKwh: 10,
      rateId: 'rate-1',
      unitPrice: 1.5,
      amount: 15,
      isRefundable: true,
      refundPercentage: 100,
      ...overrides,
    });

    test('设备故障应全额退款所有可退片段', () => {
      const segments = [
        createSegment({ segmentType: 'ENERGY', amount: 66 }),
        createSegment({ segmentType: 'SERVICE', amount: 10 }),
      ];

      const result = service.calculateRefund(InterruptionReason.EQUIPMENT_FAULT, segments);

      expect(result.energyAmount).toBe(66);
      expect(result.serviceAmount).toBe(10);
      expect(result.totalAmount).toBe(76);
    });

    test('用户停止应50%退款', () => {
      const segments = [
        createSegment({ segmentType: 'ENERGY', amount: 100 }),
        createSegment({ segmentType: 'SERVICE', amount: 20 }),
      ];

      const result = service.calculateRefund(InterruptionReason.USER_STOP, segments);

      expect(result.energyAmount).toBe(50);
      expect(result.serviceAmount).toBe(10);
      expect(result.totalAmount).toBe(60);
    });

    test('车辆问题不应有任何退款', () => {
      const segments = [
        createSegment({ segmentType: 'ENERGY', amount: 100 }),
        createSegment({ segmentType: 'SERVICE', amount: 20 }),
      ];

      const result = service.calculateRefund(InterruptionReason.VEHICLE_ISSUE, segments);

      expect(result.energyAmount).toBe(0);
      expect(result.serviceAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    test('标记为不可退款的片段不应退款', () => {
      const segments = [
        createSegment({ segmentType: 'ENERGY', amount: 100, isRefundable: false }),
        createSegment({ segmentType: 'SERVICE', amount: 20, isRefundable: true }),
      ];

      const result = service.calculateRefund(InterruptionReason.EQUIPMENT_FAULT, segments);

      expect(result.energyAmount).toBe(0);
      expect(result.serviceAmount).toBe(20);
      expect(result.totalAmount).toBe(20);
    });

    test('片段有退款比例限制时应取最小值', () => {
      const segments = [
        createSegment({ 
          segmentType: 'ENERGY', 
          amount: 100, 
          refundPercentage: 30 
        }),
      ];

      const result = service.calculateRefund(InterruptionReason.EQUIPMENT_FAULT, segments);

      expect(result.energyAmount).toBe(30);
      expect(result.totalAmount).toBe(30);
    });

    test('多片段应正确累加', () => {
      const segments = [
        createSegment({ segmentType: 'ENERGY', amount: 36 }),
        createSegment({ segmentType: 'ENERGY', amount: 30 }),
        createSegment({ segmentType: 'SERVICE', amount: 10 }),
      ];

      const result = service.calculateRefund(InterruptionReason.EQUIPMENT_FAULT, segments);

      expect(result.energyAmount).toBe(66);
      expect(result.serviceAmount).toBe(10);
      expect(result.totalAmount).toBe(76);
    });
  });

  describe('isTotalAmountValid', () => {
    const createValidCalculation = () => ({
      energyAmount: 50,
      serviceAmount: 10,
      totalAmount: 60,
      energySegments: [{ segmentId: '1', originalAmount: 100, refundPercentage: 50, refundAmount: 50, reason: 'test' }],
      serviceSegments: [{ segmentId: '2', originalAmount: 20, refundPercentage: 50, refundAmount: 10, reason: 'test' }],
    });

    test('正确的金额验证应该通过', () => {
      const calc = createValidCalculation();
      expect(service.isTotalAmountValid(calc)).toBe(true);
    });

    test('总金额为负应该失败', () => {
      const calc = { ...createValidCalculation(), totalAmount: -1 };
      expect(service.isTotalAmountValid(calc)).toBe(false);
    });

    test('电量金额为负应该失败', () => {
      const calc = { ...createValidCalculation(), energyAmount: -1 };
      expect(service.isTotalAmountValid(calc)).toBe(false);
    });

    test('服务金额为负应该失败', () => {
      const calc = { ...createValidCalculation(), serviceAmount: -1 };
      expect(service.isTotalAmountValid(calc)).toBe(false);
    });

    test('总金额与片段合计不一致应该失败', () => {
      const calc = {
        ...createValidCalculation(),
        totalAmount: 100,
      };
      expect(service.isTotalAmountValid(calc)).toBe(false);
    });
  });

  describe('hasRefundAmount', () => {
    test('有退款金额应返回true', () => {
      const calc = {
        energyAmount: 1,
        serviceAmount: 0,
        totalAmount: 1,
        energySegments: [],
        serviceSegments: [],
      };
      expect(service.hasRefundAmount(calc)).toBe(true);
    });

    test('无退款金额应返回false', () => {
      const calc = {
        energyAmount: 0,
        serviceAmount: 0,
        totalAmount: 0,
        energySegments: [],
        serviceSegments: [],
      };
      expect(service.hasRefundAmount(calc)).toBe(false);
    });
  });
});
