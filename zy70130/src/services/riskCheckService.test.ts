import { describe, expect, it, beforeEach } from '@jest/globals';
import { RiskCheckService } from './riskCheckService';
import { RiskLevel } from '../types';
import { config } from '../config';

describe('RiskCheckService', () => {
  let service: RiskCheckService;

  beforeEach(() => {
    service = new RiskCheckService();
  });

  describe('checkVerification', () => {
    it('双方都已实名认证应该通过', () => {
      const result = service.checkVerification(true, true);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.reasons).toHaveLength(0);
    });

    it('转出方未实名认证应该失败', () => {
      const result = service.checkVerification(false, true);
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.reasons).toContain('转出方未实名认证');
    });

    it('转入方未实名认证应该失败', () => {
      const result = service.checkVerification(true, false);
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.reasons).toContain('转入方未实名认证');
    });

    it('双方都未实名认证应该失败并包含两个原因', () => {
      const result = service.checkVerification(false, false);
      expect(result.passed).toBe(false);
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe('checkCoolDown', () => {
    const now = Date.now();

    it('从未转赠过应该通过', () => {
      const result = service.checkCoolDown(null, now);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('冷却期已过应该通过', () => {
      const lastTransfer = now - (config.coolDownPeriodHours + 1) * 60 * 60 * 1000;
      const result = service.checkCoolDown(lastTransfer, now);
      expect(result.passed).toBe(true);
    });

    it('冷却期内应该失败', () => {
      const lastTransfer = now - 12 * 60 * 60 * 1000;
      const result = service.checkCoolDown(lastTransfer, now);
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('刚转赠完应该失败', () => {
      const lastTransfer = now - 1000;
      const result = service.checkCoolDown(lastTransfer, now);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkFrequency', () => {
    it('在限制内应该通过', () => {
      const result = service.checkFrequency(0, 0);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('接近上限但未达应该通过', () => {
      const result = service.checkFrequency(
        config.maxTransfersPerHour - 1,
        config.maxTransfersPerDay - 1
      );
      expect(result.passed).toBe(true);
    });

    it('超过每小时限制应该失败', () => {
      const result = service.checkFrequency(
        config.maxTransfersPerHour,
        config.maxTransfersPerDay - 1
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(
        expect.stringContaining('1小时内转赠次数已达上限')
      );
    });

    it('超过每日限制应该失败', () => {
      const result = service.checkFrequency(
        config.maxTransfersPerHour - 1,
        config.maxTransfersPerDay
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(
        expect.stringContaining('24小时内转赠次数已达上限')
      );
    });

    it('同时超过两个限制应该包含两个原因', () => {
      const result = service.checkFrequency(
        config.maxTransfersPerHour + 1,
        config.maxTransfersPerDay + 1
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe('checkFrozen', () => {
    it('都未冻结应该通过', () => {
      const result = service.checkFrozen(false, false);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('转出方被冻结应该失败', () => {
      const result = service.checkFrozen(true, false);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('转出账户已被冻结');
    });

    it('藏品被冻结应该失败', () => {
      const result = service.checkFrozen(false, true);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('藏品已被冻结');
    });

    it('都被冻结应该包含两个原因', () => {
      const result = service.checkFrozen(true, true);
      expect(result.passed).toBe(false);
      expect(result.reasons).toHaveLength(2);
    });
  });

  describe('checkOwnership', () => {
    it('所有者正确应该通过', () => {
      const result = service.checkOwnership('user1', 'user1');
      expect(result.passed).toBe(true);
    });

    it('所有者不正确应该失败', () => {
      const result = service.checkOwnership('user1', 'user2');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.reasons).toContain('转出方不是藏品当前持有者');
    });
  });

  describe('checkSelfTransfer', () => {
    it('转赠给不同用户应该通过', () => {
      const result = service.checkSelfTransfer('user1', 'user2');
      expect(result.passed).toBe(true);
    });

    it('转赠给自己应该失败', () => {
      const result = service.checkSelfTransfer('user1', 'user1');
      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(result.reasons).toContain('不能转赠给自己');
    });
  });

  describe('aggregateResults', () => {
    it('全部通过应该返回通过', () => {
      const results = [
        { passed: true, riskLevel: RiskLevel.LOW, reasons: [] },
        { passed: true, riskLevel: RiskLevel.LOW, reasons: [] },
      ];
      const result = service.aggregateResults(results);
      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.reasons).toHaveLength(0);
    });

    it('有一个失败应该返回失败', () => {
      const results = [
        { passed: true, riskLevel: RiskLevel.LOW, reasons: [] },
        { passed: false, riskLevel: RiskLevel.HIGH, reasons: ['错误1'] },
        { passed: true, riskLevel: RiskLevel.LOW, reasons: [] },
      ];
      const result = service.aggregateResults(results);
      expect(result.passed).toBe(false);
      expect(result.reasons).toContain('错误1');
    });

    it('应该取最高风险等级', () => {
      const results = [
        { passed: true, riskLevel: RiskLevel.LOW, reasons: [] },
        { passed: false, riskLevel: RiskLevel.MEDIUM, reasons: ['错误1'] },
        { passed: false, riskLevel: RiskLevel.HIGH, reasons: ['错误2'] },
      ];
      const result = service.aggregateResults(results);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('应该合并所有原因', () => {
      const results = [
        { passed: false, riskLevel: RiskLevel.HIGH, reasons: ['错误1'] },
        { passed: false, riskLevel: RiskLevel.HIGH, reasons: ['错误2'] },
      ];
      const result = service.aggregateResults(results);
      expect(result.reasons).toContain('错误1');
      expect(result.reasons).toContain('错误2');
    });
  });
});
