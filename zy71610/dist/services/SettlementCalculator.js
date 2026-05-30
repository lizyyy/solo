"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementCalculator = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
class SettlementCalculator {
    createReason(code, message, source, operator) {
        return {
            code,
            message,
            source,
            timestamp: (0, dayjs_1.default)().toISOString(),
            operator,
        };
    }
    createVersionedValue(original, corrected) {
        return {
            original,
            corrected,
            final: corrected !== undefined ? corrected : original,
        };
    }
    calculateRemainingPrincipal(contract, flows) {
        const reasons = [];
        const totalPrincipal = contract.principal.final;
        const paidPrincipal = flows.reduce((sum, f) => sum + f.paidPrincipal, 0);
        const remaining = totalPrincipal - paidPrincipal;
        reasons.push(this.createReason('PRINCIPAL_CALC', `剩余本金计算：合同本金${totalPrincipal}元 - 已还本金${paidPrincipal}元 = ${remaining}元`, 'SettlementCalculator.calculateRemainingPrincipal'));
        return { amount: Math.max(0, remaining), reasons };
    }
    calculateRemainingServiceFee(contract, flows) {
        const reasons = [];
        const totalServiceFee = contract.principal.final * contract.serviceFeeRate;
        const paidServiceFee = flows.reduce((sum, f) => sum + f.paidServiceFee, 0);
        const remaining = totalServiceFee - paidServiceFee;
        reasons.push(this.createReason('SERVICE_FEE_CALC', `剩余服务费计算：总服务费${totalServiceFee}元 - 已付服务费${paidServiceFee}元 = ${remaining}元`, 'SettlementCalculator.calculateRemainingServiceFee'));
        return { amount: Math.max(0, remaining), reasons };
    }
    calculateRefundableServiceFee(contract, flows, feeRule, settlementDate) {
        const reasons = [];
        const totalServiceFee = contract.principal.final * contract.serviceFeeRate;
        const settledTerms = flows.filter((f) => f.status === 'PAID').length;
        const totalTerms = contract.termCount;
        const unusedRatio = (totalTerms - settledTerms) / totalTerms;
        const rawRefund = totalServiceFee * unusedRatio * feeRule.serviceFeeRefundRate;
        const refund = Math.max(feeRule.minServiceFeeRefund, rawRefund);
        reasons.push(this.createReason('REFUND_CALC', `可退服务费计算：总服务费${totalServiceFee}元 × 未使用比例${(unusedRatio * 100).toFixed(2)}% × 退款费率${(feeRule.serviceFeeRefundRate * 100).toFixed(2)}% = ${refund}元（最低${feeRule.minServiceFeeRefund}元）`, 'SettlementCalculator.calculateRefundableServiceFee'));
        return { amount: refund, reasons };
    }
    calculateEarlySettlementPenalty(remainingPrincipal, feeRule) {
        const reasons = [];
        const penalty = remainingPrincipal * feeRule.earlySettlementPenaltyRate;
        reasons.push(this.createReason('PENALTY_CALC', `提前结清违约金：剩余本金${remainingPrincipal}元 × 违约金率${(feeRule.earlySettlementPenaltyRate * 100).toFixed(2)}% = ${penalty}元`, 'SettlementCalculator.calculateEarlySettlementPenalty'));
        return { amount: penalty, reasons };
    }
    calculateTotalPayable(remainingPrincipal, earlySettlementPenalty, overdueRecords) {
        const reasons = [];
        const totalOverdueAmount = overdueRecords
            .filter((o) => o.status === 'ACTIVE')
            .reduce((sum, o) => sum + o.overdueAmount.final + o.penaltyAmount.final, 0);
        const total = remainingPrincipal + earlySettlementPenalty + totalOverdueAmount;
        reasons.push(this.createReason('TOTAL_PAYABLE_CALC', `应还总额计算：剩余本金${remainingPrincipal}元 + 提前结清违约金${earlySettlementPenalty}元 + 逾期本息罚息${totalOverdueAmount}元 = ${total}元`, 'SettlementCalculator.calculateTotalPayable'));
        return { amount: total, reasons };
    }
    calculateSettlement(contract, flows, overdueRecords, feeRule, expectedSettlementDate, operator) {
        const trialReasons = [];
        const feeReversalReasons = [];
        const principalResult = this.calculateRemainingPrincipal(contract, flows);
        trialReasons.push(...principalResult.reasons);
        const serviceFeeResult = this.calculateRemainingServiceFee(contract, flows);
        trialReasons.push(...serviceFeeResult.reasons);
        const refundResult = this.calculateRefundableServiceFee(contract, flows, feeRule, expectedSettlementDate);
        feeReversalReasons.push(...refundResult.reasons);
        const penaltyResult = this.calculateEarlySettlementPenalty(principalResult.amount, feeRule);
        trialReasons.push(...penaltyResult.reasons);
        const totalResult = this.calculateTotalPayable(principalResult.amount, penaltyResult.amount, overdueRecords);
        trialReasons.push(...totalResult.reasons);
        return {
            remainingPrincipal: this.createVersionedValue(principalResult.amount),
            remainingServiceFee: this.createVersionedValue(serviceFeeResult.amount),
            refundableServiceFee: this.createVersionedValue(refundResult.amount),
            earlySettlementPenalty: this.createVersionedValue(penaltyResult.amount),
            totalPayableAmount: this.createVersionedValue(totalResult.amount),
            reasons: {
                trialCalculation: trialReasons,
                feeReversal: feeReversalReasons,
                flowVerification: [],
                stateTransition: [],
            },
        };
    }
}
exports.SettlementCalculator = SettlementCalculator;
//# sourceMappingURL=SettlementCalculator.js.map