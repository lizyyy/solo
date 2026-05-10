import { stateMachineEngine } from '../src/state-machine/StateMachineEngine';
import { ChannelIncentiveStatus, OperatorInfo } from '../src/models/types';

describe('StateMachineEngine', () => {
  const operator: OperatorInfo = {
    operatorId: 'test-001',
    operatorName: '测试用户',
    operatorRole: 'TEST',
    timestamp: new Date()
  };

  describe('状态流转验证', () => {
    it('应该允许从 INITIAL 流转到 PENDING_VERIFICATION', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.INITIAL,
        toStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 PENDING_VERIFICATION 流转到 VERIFIED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        toStatus: ChannelIncentiveStatus.VERIFIED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 VERIFIED 流转到 DISPUTED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.DISPUTED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 VERIFIED 流转到 APPROVED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.APPROVED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 DISPUTED 流转到 MANUAL_REVIEW', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.DISPUTED,
        toStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 MANUAL_REVIEW 流转到 APPROVED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.MANUAL_REVIEW,
        toStatus: ChannelIncentiveStatus.APPROVED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });

    it('应该允许从 APPROVED 流转到 PAYOUT_SCHEDULED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.APPROVED,
        toStatus: ChannelIncentiveStatus.PAYOUT_SCHEDULED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('非法流转拦截', () => {
    it('应该阻止从 INITIAL 直接流转到 APPROVED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.INITIAL,
        toStatus: ChannelIncentiveStatus.APPROVED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_TRANSITION');
      expect(result.errorMessage).toContain('不能从');
      expect(result.allowedTransitions).toBeDefined();
    });

    it('应该阻止从 VERIFIED 直接流转到 PAID', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.PAID,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('已验证');
      expect(result.errorMessage).toContain('已付款');
    });

    it('应该阻止从 PAID 流转到 APPROVED', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.PAID,
        toStatus: ChannelIncentiveStatus.APPROVED,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(false);
    });

    it('应该在非法流转时返回允许的状态列表', () => {
      const result = stateMachineEngine.canTransition({
        fromStatus: ChannelIncentiveStatus.VERIFIED,
        toStatus: ChannelIncentiveStatus.PAID,
        operator,
        reason: '测试'
      });
      expect(result.allowedTransitions).toBeDefined();
      expect(result.allowedTransitions!.length).toBeGreaterThan(0);
      expect(result.allowedTransitions).toContain(ChannelIncentiveStatus.DISPUTED);
      expect(result.allowedTransitions).toContain(ChannelIncentiveStatus.APPROVED);
    });
  });

  describe('状态流转执行', () => {
    it('应该成功执行合法的状态流转', () => {
      const result = stateMachineEngine.transition({
        fromStatus: ChannelIncentiveStatus.INITIAL,
        toStatus: ChannelIncentiveStatus.PENDING_VERIFICATION,
        operator,
        reason: '提交审核'
      });
      expect(result.success).toBe(true);
      expect(result.statusChange).toBeDefined();
      expect(result.statusChange!.fromStatus).toBe(ChannelIncentiveStatus.INITIAL);
      expect(result.statusChange!.toStatus).toBe(ChannelIncentiveStatus.PENDING_VERIFICATION);
      expect(result.statusChange!.operator.operatorId).toBe('test-001');
      expect(result.statusChange!.reason).toBe('提交审核');
    });

    it('应该拒绝执行非法的状态流转', () => {
      const result = stateMachineEngine.transition({
        fromStatus: ChannelIncentiveStatus.INITIAL,
        toStatus: ChannelIncentiveStatus.PAID,
        operator,
        reason: '测试'
      });
      expect(result.success).toBe(false);
      expect(result.statusChange).toBeUndefined();
    });
  });

  describe('获取允许的流转状态', () => {
    it('应该返回 VERIFIED 状态允许的流转', () => {
      const transitions = stateMachineEngine.getAllowedTransitions(ChannelIncentiveStatus.VERIFIED);
      expect(transitions).toContain(ChannelIncentiveStatus.DISPUTED);
      expect(transitions).toContain(ChannelIncentiveStatus.APPROVED);
      expect(transitions).toContain(ChannelIncentiveStatus.REJECTED);
    });

    it('应该返回 APPROVED 状态允许的流转', () => {
      const transitions = stateMachineEngine.getAllowedTransitions(ChannelIncentiveStatus.APPROVED);
      expect(transitions).toContain(ChannelIncentiveStatus.PAYOUT_SCHEDULED);
      expect(transitions).toContain(ChannelIncentiveStatus.DISPUTED);
    });
  });
});
