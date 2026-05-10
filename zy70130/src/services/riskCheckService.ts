import { RiskLevel, RiskCheckResult } from '../types';
import { config } from '../config';

export class RiskCheckService {
  checkVerification(
    fromIsVerified: boolean,
    toIsVerified: boolean
  ): RiskCheckResult {
    const reasons: string[] = [];

    if (!fromIsVerified) {
      reasons.push('转出方未实名认证');
    }
    if (!toIsVerified) {
      reasons.push('转入方未实名认证');
    }

    return {
      passed: reasons.length === 0,
      riskLevel: reasons.length > 0 ? RiskLevel.HIGH : RiskLevel.LOW,
      reasons,
    };
  }

  checkCoolDown(
    lastTransferTime: number | null,
    currentTime: number
  ): RiskCheckResult {
    if (!lastTransferTime) {
      return {
        passed: true,
        riskLevel: RiskLevel.LOW,
        reasons: [],
      };
    }

    const coolDownMs = config.coolDownPeriodHours * 60 * 60 * 1000;
    const elapsed = currentTime - lastTransferTime;

    if (elapsed < coolDownMs) {
      const remainingMs = coolDownMs - elapsed;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return {
        passed: false,
        riskLevel: RiskLevel.MEDIUM,
        reasons: [`藏品处于冷却期，还需等待${remainingHours}小时`],
      };
    }

    return {
      passed: true,
      riskLevel: RiskLevel.LOW,
      reasons: [],
    };
  }

  checkFrequency(
    transferCountInHour: number,
    transferCountInDay: number
  ): RiskCheckResult {
    const reasons: string[] = [];

    if (transferCountInHour >= config.maxTransfersPerHour) {
      reasons.push(`1小时内转赠次数已达上限(${config.maxTransfersPerHour}次)`);
    }

    if (transferCountInDay >= config.maxTransfersPerDay) {
      reasons.push(`24小时内转赠次数已达上限(${config.maxTransfersPerDay}次)`);
    }

    if (reasons.length > 0) {
      return {
        passed: false,
        riskLevel: RiskLevel.HIGH,
        reasons,
      };
    }

    return {
      passed: true,
      riskLevel: RiskLevel.LOW,
      reasons: [],
    };
  }

  checkFrozen(
    fromIsFrozen: boolean,
    collectionIsFrozen: boolean
  ): RiskCheckResult {
    const reasons: string[] = [];

    if (fromIsFrozen) {
      reasons.push('转出账户已被冻结');
    }
    if (collectionIsFrozen) {
      reasons.push('藏品已被冻结');
    }

    if (reasons.length > 0) {
      return {
        passed: false,
        riskLevel: RiskLevel.HIGH,
        reasons,
      };
    }

    return {
      passed: true,
      riskLevel: RiskLevel.LOW,
      reasons: [],
    };
  }

  checkOwnership(ownerId: string, fromUserId: string): RiskCheckResult {
    if (ownerId !== fromUserId) {
      return {
        passed: false,
        riskLevel: RiskLevel.HIGH,
        reasons: ['转出方不是藏品当前持有者'],
      };
    }

    return {
      passed: true,
      riskLevel: RiskLevel.LOW,
      reasons: [],
    };
  }

  checkSelfTransfer(fromUserId: string, toUserId: string): RiskCheckResult {
    if (fromUserId === toUserId) {
      return {
        passed: false,
        riskLevel: RiskLevel.MEDIUM,
        reasons: ['不能转赠给自己'],
      };
    }

    return {
      passed: true,
      riskLevel: RiskLevel.LOW,
      reasons: [],
    };
  }

  aggregateResults(results: RiskCheckResult[]): RiskCheckResult {
    const allReasons: string[] = [];
    let highestRisk = RiskLevel.LOW;
    let allPassed = true;

    for (const result of results) {
      allReasons.push(...result.reasons);
      if (!result.passed) {
        allPassed = false;
      }
      if (this.isHigherRisk(result.riskLevel, highestRisk)) {
        highestRisk = result.riskLevel;
      }
    }

    return {
      passed: allPassed,
      riskLevel: highestRisk,
      reasons: allReasons,
    };
  }

  private isHigherRisk(current: RiskLevel, baseline: RiskLevel): boolean {
    const order = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 1,
      [RiskLevel.HIGH]: 2,
    };
    return order[current] > order[baseline];
  }
}

export const riskCheckService = new RiskCheckService();
