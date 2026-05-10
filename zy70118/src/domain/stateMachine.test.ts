import {
  BatchStatus,
  InspectionType,
  canTransition,
  validateTransition,
  checkDuplicateSubmission,
  isTerminalStatus,
  getNextRequiredState,
  InvalidStateTransitionError,
  DuplicateSubmissionError,
  Batch
} from './';

describe('状态机测试', () => {
  describe('canTransition', () => {
    it('应允许从 PENDING 流转到 TEMPERATURE_CHECKED', () => {
      expect(canTransition(BatchStatus.PENDING, BatchStatus.TEMPERATURE_CHECKED)).toBe(true);
    });

    it('应允许从 PENDING 流转到 REJECTED', () => {
      expect(canTransition(BatchStatus.PENDING, BatchStatus.REJECTED)).toBe(true);
    });

    it('不应允许从 PENDING 直接流转到 ACCEPTED', () => {
      expect(canTransition(BatchStatus.PENDING, BatchStatus.ACCEPTED)).toBe(false);
    });

    it('不应允许从 ACCEPTED 继续流转（终态）', () => {
      expect(canTransition(BatchStatus.ACCEPTED, BatchStatus.REJECTED)).toBe(false);
    });

    it('应允许从 REJECTED 流转到 REPLENISHED', () => {
      expect(canTransition(BatchStatus.REJECTED, BatchStatus.REPLENISHED)).toBe(true);
    });
  });

  describe('validateTransition', () => {
    it('有效流转不应抛出异常', () => {
      expect(() => {
        validateTransition(BatchStatus.PENDING, BatchStatus.TEMPERATURE_CHECKED);
      }).not.toThrow();
    });

    it('无效流转应抛出 InvalidStateTransitionError', () => {
      expect(() => {
        validateTransition(BatchStatus.PENDING, BatchStatus.ACCEPTED);
      }).toThrow(InvalidStateTransitionError);
    });

    it('异常消息应包含清晰的中文说明', () => {
      try {
        validateTransition(BatchStatus.PENDING, BatchStatus.ACCEPTED);
      } catch (e) {
        const error = e as InvalidStateTransitionError;
        expect(error.message).toContain('状态流转非法');
        expect(error.message).toContain('待验收');
        expect(error.message).toContain('已验收');
        expect(error.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  describe('checkDuplicateSubmission', () => {
    const baseBatch: Batch = {
      id: 'test-batch',
      supplierId: 'S001',
      materialCode: 'M001',
      materialName: '测试物料',
      quantity: 100,
      unit: 'kg',
      expectedDeliveryDate: new Date(),
      actualDeliveryDate: new Date(),
      operatorId: 'OP001',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      version: 0,
      status: BatchStatus.PENDING,
      temperatureChecks: [],
      weightChecks: [],
      ticketChecks: [],
      rejectionReasons: []
    };

    it('PENDING 状态不应触发重复提交错误', () => {
      const batch = { ...baseBatch, status: BatchStatus.PENDING };
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.TEMPERATURE);
      }).not.toThrow();
    });

    it('TEMPERATURE_CHECKED 后重复验温应抛出错误', () => {
      const batch = { ...baseBatch, status: BatchStatus.TEMPERATURE_CHECKED };
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.TEMPERATURE);
      }).toThrow(DuplicateSubmissionError);
    });

    it('WEIGHT_CHECKED 后重复验重应抛出错误', () => {
      const batch = { ...baseBatch, status: BatchStatus.WEIGHT_CHECKED };
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.WEIGHT);
      }).toThrow(DuplicateSubmissionError);
    });

    it('TICKET_CHECKED 后重复验票应抛出错误', () => {
      const batch = { ...baseBatch, status: BatchStatus.TICKET_CHECKED };
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.TICKET);
      }).toThrow(DuplicateSubmissionError);
    });

    it('ACCEPTED 后任何验收操作都应抛出错误', () => {
      const batch = { ...baseBatch, status: BatchStatus.ACCEPTED };
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.TEMPERATURE);
      }).toThrow(DuplicateSubmissionError);
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.WEIGHT);
      }).toThrow(DuplicateSubmissionError);
      expect(() => {
        checkDuplicateSubmission(batch, InspectionType.TICKET);
      }).toThrow(DuplicateSubmissionError);
    });
  });

  describe('isTerminalStatus', () => {
    it('ACCEPTED 应为终态', () => {
      expect(isTerminalStatus(BatchStatus.ACCEPTED)).toBe(true);
    });

    it('PARTIALLY_ACCEPTED 应为终态', () => {
      expect(isTerminalStatus(BatchStatus.PARTIALLY_ACCEPTED)).toBe(true);
    });

    it('REJECTED 应为终态', () => {
      expect(isTerminalStatus(BatchStatus.REJECTED)).toBe(true);
    });

    it('PENDING 不应为终态', () => {
      expect(isTerminalStatus(BatchStatus.PENDING)).toBe(false);
    });

    it('REPLENISHED 不应为终态（还能补货后重验）', () => {
      expect(isTerminalStatus(BatchStatus.REPLENISHED)).toBe(false);
    });
  });

  describe('getNextRequiredState', () => {
    it('PENDING 下一步应为 TEMPERATURE_CHECKED', () => {
      expect(getNextRequiredState(BatchStatus.PENDING)).toBe(BatchStatus.TEMPERATURE_CHECKED);
    });

    it('TEMPERATURE_CHECKED 下一步应为 WEIGHT_CHECKED', () => {
      expect(getNextRequiredState(BatchStatus.TEMPERATURE_CHECKED)).toBe(BatchStatus.WEIGHT_CHECKED);
    });

    it('WEIGHT_CHECKED 下一步应为 TICKET_CHECKED', () => {
      expect(getNextRequiredState(BatchStatus.WEIGHT_CHECKED)).toBe(BatchStatus.TICKET_CHECKED);
    });

    it('TICKET_CHECKED 下一步应为 ACCEPTED', () => {
      expect(getNextRequiredState(BatchStatus.TICKET_CHECKED)).toBe(BatchStatus.ACCEPTED);
    });

    it('ACCEPTED 没有下一步', () => {
      expect(getNextRequiredState(BatchStatus.ACCEPTED)).toBeNull();
    });
  });
});
