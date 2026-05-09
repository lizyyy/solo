import { stateMachine } from '../src/services/state-machine';
import { RefundStatus, Role } from '@prisma/client';

describe('状态机测试', () => {
  describe('状态流转验证', () => {
    it('DRAFT -> PENDING_REVIEW 应该允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.DRAFT,
        RefundStatus.PENDING_REVIEW,
        Role.OPERATOR
      );
      expect(result.allowed).toBe(true);
    });

    it('DRAFT -> APPROVED 应该不允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.DRAFT,
        RefundStatus.APPROVED,
        Role.OPERATOR
      );
      expect(result.allowed).toBe(false);
    });

    it('PENDING_REVIEW -> APPROVED 经理应该允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.PENDING_REVIEW,
        RefundStatus.APPROVED,
        Role.MANAGER
      );
      expect(result.allowed).toBe(true);
    });

    it('PENDING_REVIEW -> APPROVED 操作员应该不允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.PENDING_REVIEW,
        RefundStatus.APPROVED,
        Role.OPERATOR
      );
      expect(result.allowed).toBe(false);
    });

    it('FAILED -> PROCESSING 应该允许（重试）', () => {
      const result = stateMachine.canTransition(
        RefundStatus.FAILED,
        RefundStatus.PROCESSING,
        Role.OPERATOR
      );
      expect(result.allowed).toBe(true);
    });

    it('SUCCESS -> 任何状态 应该不允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.SUCCESS,
        RefundStatus.PROCESSING,
        Role.ADMIN
      );
      expect(result.allowed).toBe(false);
    });

    it('相同状态转换 应该不允许', () => {
      const result = stateMachine.canTransition(
        RefundStatus.DRAFT,
        RefundStatus.DRAFT,
        Role.OPERATOR
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('最终状态检查', () => {
    it('SUCCESS 应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.SUCCESS)).toBe(true);
    });

    it('FAILED 应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.FAILED)).toBe(true);
    });

    it('CANCELLED 应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.CANCELLED)).toBe(true);
    });

    it('REJECTED 应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.REJECTED)).toBe(true);
    });

    it('DRAFT 不应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.DRAFT)).toBe(false);
    });

    it('PROCESSING 不应该是最终状态', () => {
      expect(stateMachine.isFinalStatus(RefundStatus.PROCESSING)).toBe(false);
    });
  });

  describe('可重试检查', () => {
    it('FAILED 状态应该可以重试', () => {
      expect(stateMachine.canRetry(RefundStatus.FAILED)).toBe(true);
    });

    it('其他状态不应该可以重试', () => {
      expect(stateMachine.canRetry(RefundStatus.DRAFT)).toBe(false);
      expect(stateMachine.canRetry(RefundStatus.SUCCESS)).toBe(false);
      expect(stateMachine.canRetry(RefundStatus.PROCESSING)).toBe(false);
    });
  });

  describe('可编辑检查', () => {
    it('DRAFT 状态应该可以编辑', () => {
      expect(stateMachine.canEdit(RefundStatus.DRAFT)).toBe(true);
    });

    it('PENDING_REVIEW 状态应该可以编辑', () => {
      expect(stateMachine.canEdit(RefundStatus.PENDING_REVIEW)).toBe(true);
    });

    it('其他状态不应该可以编辑', () => {
      expect(stateMachine.canEdit(RefundStatus.APPROVED)).toBe(false);
      expect(stateMachine.canEdit(RefundStatus.SUCCESS)).toBe(false);
      expect(stateMachine.canEdit(RefundStatus.FAILED)).toBe(false);
    });
  });

  describe('获取可用转换', () => {
    it('DRAFT 状态操作员应该有2个可用转换', () => {
      const transitions = stateMachine.getValidTransitions(
        RefundStatus.DRAFT,
        Role.OPERATOR
      );
      expect(transitions.length).toBe(2);
      expect(transitions.map(t => t.to)).toContain(RefundStatus.PENDING_REVIEW);
      expect(transitions.map(t => t.to)).toContain(RefundStatus.CANCELLED);
    });

    it('PENDING_REVIEW 状态经理应该有3个可用转换', () => {
      const transitions = stateMachine.getValidTransitions(
        RefundStatus.PENDING_REVIEW,
        Role.MANAGER
      );
      expect(transitions.length).toBe(3);
      expect(transitions.map(t => t.to)).toContain(RefundStatus.APPROVED);
      expect(transitions.map(t => t.to)).toContain(RefundStatus.REJECTED);
      expect(transitions.map(t => t.to)).toContain(RefundStatus.DRAFT);
    });

    it('FAILED 状态应该有1个可用转换（重试）', () => {
      const transitions = stateMachine.getValidTransitions(
        RefundStatus.FAILED,
        Role.OPERATOR
      );
      expect(transitions.length).toBe(1);
      expect(transitions[0].to).toBe(RefundStatus.PROCESSING);
    });

    it('SUCCESS 状态应该没有可用转换', () => {
      const transitions = stateMachine.getValidTransitions(
        RefundStatus.SUCCESS,
        Role.ADMIN
      );
      expect(transitions.length).toBe(0);
    });
  });
});
