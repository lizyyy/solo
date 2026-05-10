"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskCheckService = exports.RiskCheckService = void 0;
const types_1 = require("../types");
const config_1 = require("../config");
class RiskCheckService {
    checkVerification(fromIsVerified, toIsVerified) {
        const reasons = [];
        if (!fromIsVerified) {
            reasons.push('转出方未实名认证');
        }
        if (!toIsVerified) {
            reasons.push('转入方未实名认证');
        }
        return {
            passed: reasons.length === 0,
            riskLevel: reasons.length > 0 ? types_1.RiskLevel.HIGH : types_1.RiskLevel.LOW,
            reasons,
        };
    }
    checkCoolDown(lastTransferTime, currentTime) {
        if (!lastTransferTime) {
            return {
                passed: true,
                riskLevel: types_1.RiskLevel.LOW,
                reasons: [],
            };
        }
        const coolDownMs = config_1.config.coolDownPeriodHours * 60 * 60 * 1000;
        const elapsed = currentTime - lastTransferTime;
        if (elapsed < coolDownMs) {
            const remainingMs = coolDownMs - elapsed;
            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            return {
                passed: false,
                riskLevel: types_1.RiskLevel.MEDIUM,
                reasons: [`藏品处于冷却期，还需等待${remainingHours}小时`],
            };
        }
        return {
            passed: true,
            riskLevel: types_1.RiskLevel.LOW,
            reasons: [],
        };
    }
    checkFrequency(transferCountInHour, transferCountInDay) {
        const reasons = [];
        if (transferCountInHour >= config_1.config.maxTransfersPerHour) {
            reasons.push(`1小时内转赠次数已达上限(${config_1.config.maxTransfersPerHour}次)`);
        }
        if (transferCountInDay >= config_1.config.maxTransfersPerDay) {
            reasons.push(`24小时内转赠次数已达上限(${config_1.config.maxTransfersPerDay}次)`);
        }
        if (reasons.length > 0) {
            return {
                passed: false,
                riskLevel: types_1.RiskLevel.HIGH,
                reasons,
            };
        }
        return {
            passed: true,
            riskLevel: types_1.RiskLevel.LOW,
            reasons: [],
        };
    }
    checkFrozen(fromIsFrozen, collectionIsFrozen) {
        const reasons = [];
        if (fromIsFrozen) {
            reasons.push('转出账户已被冻结');
        }
        if (collectionIsFrozen) {
            reasons.push('藏品已被冻结');
        }
        if (reasons.length > 0) {
            return {
                passed: false,
                riskLevel: types_1.RiskLevel.HIGH,
                reasons,
            };
        }
        return {
            passed: true,
            riskLevel: types_1.RiskLevel.LOW,
            reasons: [],
        };
    }
    checkOwnership(ownerId, fromUserId) {
        if (ownerId !== fromUserId) {
            return {
                passed: false,
                riskLevel: types_1.RiskLevel.HIGH,
                reasons: ['转出方不是藏品当前持有者'],
            };
        }
        return {
            passed: true,
            riskLevel: types_1.RiskLevel.LOW,
            reasons: [],
        };
    }
    checkSelfTransfer(fromUserId, toUserId) {
        if (fromUserId === toUserId) {
            return {
                passed: false,
                riskLevel: types_1.RiskLevel.MEDIUM,
                reasons: ['不能转赠给自己'],
            };
        }
        return {
            passed: true,
            riskLevel: types_1.RiskLevel.LOW,
            reasons: [],
        };
    }
    aggregateResults(results) {
        const allReasons = [];
        let highestRisk = types_1.RiskLevel.LOW;
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
    isHigherRisk(current, baseline) {
        const order = {
            [types_1.RiskLevel.LOW]: 0,
            [types_1.RiskLevel.MEDIUM]: 1,
            [types_1.RiskLevel.HIGH]: 2,
        };
        return order[current] > order[baseline];
    }
}
exports.RiskCheckService = RiskCheckService;
exports.riskCheckService = new RiskCheckService();
//# sourceMappingURL=riskCheckService.js.map