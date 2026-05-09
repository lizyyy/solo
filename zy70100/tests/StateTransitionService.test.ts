import { StateTransitionService } from '../src/services/StateTransitionService';
import { RefundStatus, RejectStage } from '../src/types';

describe('StateTransitionService', () => {
  let service: StateTransitionService;

  beforeEach(() => {
    service = new StateTransitionService();
  });

  describe('canTransition', () => {
    test('PENDING 可以转换到 CALCULATED', () => {
      const result = service.canTransition(RefundStatus.PENDING, RefundStatus.CALCULATED);
      expect(result.allowed).toBe(true);
    });

    test('PENDING 可以转换到 REJECTED', () => {
      const result = service.canTransition(RefundStatus.PENDING, RefundStatus.REJECTED);
      expect(result.allowed).toBe(true);
    });

    test('CALCULATED 可以转换到 APPROVED', () => {
      const result = service.canTransition(RefundStatus.CALCULATED, RefundStatus.APPROVED);
      expect(result.allowed).toBe(true);
    });

    test('CALCULATED 可以转换到 REJECTED', () => {
      const result = service.canTransition(RefundStatus.CALCULATED, RefundStatus.REJECTED);
      expect(result.allowed).toBe(true);
    });

    test('APPROVED 可以转换到 CALLBACK_SENT', () => {
      const result = service.canTransition(RefundStatus.APPROVED, RefundStatus.CALLBACK_SENT);
      expect(result.allowed).toBe(true);
    });

    test('CALLBACK_SENT 可以转换到 RECONCILED', () => {
      const result = service.canTransition(RefundStatus.CALLBACK_SENT, RefundStatus.RECONCILED);
      expect(result.allowed).toBe(true);
    });

    test('RECONCILED 可以转换到 COMPLETED', () => {
      const result = service.canTransition(RefundStatus.RECONCILED, RefundStatus.COMPLETED);
      expect(result.allowed).toBe(true);
    });

    test('PENDING 不能直接转换到 APPROVED', () => {
      const result = service.canTransition(RefundStatus.PENDING, RefundStatus.APPROVED);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test('CALCULATED 不能直接转换到 COMPLETED', () => {
      const result = service.canTransition(RefundStatus.CALCULATED, RefundStatus.COMPLETED);
      expect(result.allowed).toBe(false);
    });

    test('COMPLETED 不能再转换到其他状态', () => {
      const result = service.canTransition(RefundStatus.COMPLETED, RefundStatus.PENDING);
      expect(result.allowed).toBe(false);
    });

    test('REJECTED 不能再转换到其他状态', () => {
      const result = service.canTransition(RefundStatus.REJECTED, RefundStatus.PENDING);
      expect(result.allowed).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    test('COMPLETED 是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.COMPLETED)).toBe(true);
    });

    test('REJECTED 是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.REJECTED)).toBe(true);
    });

    test('PENDING 不是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.PENDING)).toBe(false);
    });

    test('CALCULATED 不是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.CALCULATED)).toBe(false);
    });

    test('APPROVED 不是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.APPROVED)).toBe(false);
    });

    test('CALLBACK_SENT 不是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.CALLBACK_SENT)).toBe(false);
    });

    test('RECONCILED 不是终止状态', () => {
      expect(service.isTerminalStatus(RefundStatus.RECONCILED)).toBe(false);
    });
  });

  describe('getRejectStageForTransition', () => {
    test('PENDING 到 CALCULATED 失败时阶段是 CALCULATION', () => {
      const stage = service.getRejectStageForTransition(RefundStatus.PENDING, RefundStatus.CALCULATED);
      expect(stage).toBe(RejectStage.CALCULATION);
    });

    test('CALCULATED 到 APPROVED 失败时阶段是 APPROVAL', () => {
      const stage = service.getRejectStageForTransition(RefundStatus.CALCULATED, RefundStatus.APPROVED);
      expect(stage).toBe(RejectStage.APPROVAL);
    });

    test('APPROVED 到 CALLBACK_SENT 失败时阶段是 CALLBACK', () => {
      const stage = service.getRejectStageForTransition(RefundStatus.APPROVED, RefundStatus.CALLBACK_SENT);
      expect(stage).toBe(RejectStage.CALLBACK);
    });

    test('CALLBACK_SENT 到 RECONCILED 失败时阶段是 RECONCILIATION', () => {
      const stage = service.getRejectStageForTransition(RefundStatus.CALLBACK_SENT, RefundStatus.RECONCILED);
      expect(stage).toBe(RejectStage.RECONCILIATION);
    });
  });

  describe('getNextPossibleStatuses', () => {
    test('PENDING 的下一步状态是 CALCULATED 和 REJECTED', () => {
      const next = service.getNextPossibleStatuses(RefundStatus.PENDING);
      expect(next).toContain(RefundStatus.CALCULATED);
      expect(next).toContain(RefundStatus.REJECTED);
      expect(next.length).toBe(2);
    });

    test('CALCULATED 的下一步状态是 APPROVED 和 REJECTED', () => {
      const next = service.getNextPossibleStatuses(RefundStatus.CALCULATED);
      expect(next).toContain(RefundStatus.APPROVED);
      expect(next).toContain(RefundStatus.REJECTED);
      expect(next.length).toBe(2);
    });

    test('COMPLETED 没有下一步状态', () => {
      const next = service.getNextPossibleStatuses(RefundStatus.COMPLETED);
      expect(next.length).toBe(0);
    });

    test('REJECTED 没有下一步状态', () => {
      const next = service.getNextPossibleStatuses(RefundStatus.REJECTED);
      expect(next.length).toBe(0);
    });
  });

  describe('isSameOrEarlierStatus', () => {
    test('COMPLETED 比 RECONCILED 晚', () => {
      expect(service.isSameOrEarlierStatus(RefundStatus.RECONCILED, RefundStatus.COMPLETED)).toBe(false);
    });

    test('RECONCILED 比 COMPLETED 早', () => {
      expect(service.isSameOrEarlierStatus(RefundStatus.COMPLETED, RefundStatus.RECONCILED)).toBe(true);
    });

    test('相同状态返回 true', () => {
      expect(service.isSameOrEarlierStatus(RefundStatus.APPROVED, RefundStatus.APPROVED)).toBe(true);
    });

    test('PENDING 比所有状态都早', () => {
      expect(service.isSameOrEarlierStatus(RefundStatus.CALCULATED, RefundStatus.PENDING)).toBe(true);
      expect(service.isSameOrEarlierStatus(RefundStatus.COMPLETED, RefundStatus.PENDING)).toBe(true);
    });
  });
});
