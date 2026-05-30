"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowVerifier = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
class FlowVerifier {
    createReason(code, message, source, operator) {
        return {
            code,
            message,
            source,
            timestamp: (0, dayjs_1.default)().toISOString(),
            operator,
        };
    }
    createAnomaly(type, severity, message) {
        return {
            type,
            severity,
            message,
            resolved: false,
        };
    }
    verifyFlows(contract, flows) {
        const reasons = [];
        const anomalies = [];
        reasons.push(this.createReason('FLOW_VERIFY_START', `开始核对合同[${contract.contractNo}]的还款流水，共${flows.length}条记录`, 'FlowVerifier.verifyFlows'));
        const sortedFlows = [...flows].sort((a, b) => a.termNo - b.termNo);
        const termNos = sortedFlows.map((f) => f.termNo);
        const expectedTermNos = Array.from({ length: contract.termCount }, (_, i) => i + 1);
        const missingTerms = expectedTermNos.filter((t) => !termNos.includes(t));
        if (missingTerms.length > 0) {
            anomalies.push(this.createAnomaly('FLOW_NOT_MATCHED', 'MEDIUM', `缺失第${missingTerms.join(',')}期还款流水记录`));
            reasons.push(this.createReason('FLOW_MISSING', `缺失第${missingTerms.join(',')}期还款流水记录`, 'FlowVerifier.verifyFlows'));
        }
        const duplicateTerms = termNos.filter((t, i) => termNos.indexOf(t) !== i);
        if (duplicateTerms.length > 0) {
            anomalies.push(this.createAnomaly('FLOW_NOT_MATCHED', 'HIGH', `存在重复期数流水：第${duplicateTerms.join(',')}期`));
            reasons.push(this.createReason('FLOW_DUPLICATE', `存在重复期数流水：第${duplicateTerms.join(',')}期`, 'FlowVerifier.verifyFlows'));
        }
        const totalPaidPrincipal = sortedFlows.reduce((sum, f) => sum + f.paidPrincipal, 0);
        const totalPaidInterest = sortedFlows.reduce((sum, f) => sum + f.paidInterest, 0);
        const totalPaidServiceFee = sortedFlows.reduce((sum, f) => sum + f.paidServiceFee, 0);
        reasons.push(this.createReason('FLOW_SUMMARY', `流水汇总：已还本金${totalPaidPrincipal}元，已还利息${totalPaidInterest}元，已还服务费${totalPaidServiceFee}元`, 'FlowVerifier.verifyFlows'));
        const totalPayablePrincipal = contract.principal.final;
        if (totalPaidPrincipal > totalPayablePrincipal) {
            anomalies.push(this.createAnomaly('PRINCIPAL_MISMATCH', 'HIGH', `已还本金(${totalPaidPrincipal}元)大于合同本金(${totalPayablePrincipal}元)`));
            reasons.push(this.createReason('PRINCIPAL_OVERPAID', `已还本金(${totalPaidPrincipal}元)大于合同本金(${totalPayablePrincipal}元)，存在异常`, 'FlowVerifier.verifyFlows'));
        }
        const pendingFlows = sortedFlows.filter((f) => f.status === 'PENDING' && (0, dayjs_1.default)(f.dueDate).isBefore((0, dayjs_1.default)()));
        if (pendingFlows.length > 0) {
            anomalies.push(this.createAnomaly('FLOW_NOT_MATCHED', 'MEDIUM', `存在${pendingFlows.length}条已到期未还款记录`));
            reasons.push(this.createReason('FLOW_OVERDUE_PENDING', `存在${pendingFlows.length}条已到期未还款记录：第${pendingFlows.map(f => f.termNo).join(',')}期`, 'FlowVerifier.verifyFlows'));
        }
        return {
            isValid: anomalies.length === 0,
            reasons,
            anomalies,
            totalPaidPrincipal,
            totalPaidInterest,
            totalPaidServiceFee,
        };
    }
}
exports.FlowVerifier = FlowVerifier;
//# sourceMappingURL=FlowVerifier.js.map