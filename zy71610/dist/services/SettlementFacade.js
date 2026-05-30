"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementFacade = exports.SettlementFacade = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const DataRepository_1 = require("./DataRepository");
const SettlementCalculator_1 = require("./SettlementCalculator");
const SettlementStateMachine_1 = require("./SettlementStateMachine");
const FlowVerifier_1 = require("./FlowVerifier");
const AnomalyDetector_1 = require("./AnomalyDetector");
const ExportService_1 = require("./ExportService");
class SettlementFacade {
    constructor() {
        this.calculator = new SettlementCalculator_1.SettlementCalculator();
        this.stateMachine = new SettlementStateMachine_1.SettlementStateMachine();
        this.flowVerifier = new FlowVerifier_1.FlowVerifier();
        this.anomalyDetector = new AnomalyDetector_1.AnomalyDetector();
    }
    createSettlementApplication(contractNo, applicant, settlementReason, operator, expectedSettlementDate) {
        const contract = DataRepository_1.repository.getContract(contractNo);
        if (!contract) {
            throw new Error(`合同${contractNo}不存在`);
        }
        const flows = DataRepository_1.repository.getFlows(contractNo);
        const overdues = DataRepository_1.repository.getOverdues(contractNo);
        const feeRule = DataRepository_1.repository.getActiveFeeRule('CONSUMPTION');
        if (!feeRule) {
            throw new Error('未找到生效的费用规则');
        }
        let application = DataRepository_1.repository.createApplication({
            contractNo,
            applicant,
            operator,
            settlementReason,
            expectedSettlementDate: expectedSettlementDate || (0, dayjs_1.default)().toISOString(),
        });
        const flowResult = this.flowVerifier.verifyFlows(contract, flows);
        const calculation = this.calculator.calculateSettlement(contract, flows, overdues, feeRule, application.expectedSettlementDate, operator);
        application = {
            ...application,
            ...calculation,
            reasons: {
                ...application.reasons,
                flowVerification: flowResult.reasons,
                trialCalculation: calculation.reasons.trialCalculation,
                feeReversal: calculation.reasons.feeReversal,
            },
            anomalies: flowResult.anomalies,
        };
        const existingApps = DataRepository_1.repository.getAllApplications();
        const anomalyResult = this.anomalyDetector.detectAll(application, overdues, existingApps);
        application.anomalies = [...application.anomalies, ...anomalyResult.anomalies];
        application.reasons.trialCalculation = [
            ...application.reasons.trialCalculation,
            ...anomalyResult.reasons,
        ];
        return DataRepository_1.repository.updateApplication(application, operator);
    }
    recalculateSettlement(applicationId, operator) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        if (!this.stateMachine.isEditable(application.status)) {
            throw new Error(`当前状态${application.status}不允许重新试算`);
        }
        const contract = DataRepository_1.repository.getContract(application.contractNo);
        if (!contract) {
            throw new Error(`合同${application.contractNo}不存在`);
        }
        const flows = DataRepository_1.repository.getFlows(application.contractNo);
        const overdues = DataRepository_1.repository.getOverdues(application.contractNo);
        const feeRule = DataRepository_1.repository.getActiveFeeRule('CONSUMPTION');
        if (!feeRule) {
            throw new Error('未找到生效的费用规则');
        }
        const calculation = this.calculator.calculateSettlement(contract, flows, overdues, feeRule, application.expectedSettlementDate, operator);
        const updated = {
            ...application,
            remainingPrincipal: {
                original: calculation.remainingPrincipal.original,
                corrected: application.remainingPrincipal.corrected,
                final: application.remainingPrincipal.corrected !== undefined
                    ? application.remainingPrincipal.corrected
                    : calculation.remainingPrincipal.original,
            },
            remainingServiceFee: {
                original: calculation.remainingServiceFee.original,
                corrected: application.remainingServiceFee.corrected,
                final: application.remainingServiceFee.corrected !== undefined
                    ? application.remainingServiceFee.corrected
                    : calculation.remainingServiceFee.original,
            },
            refundableServiceFee: {
                original: calculation.refundableServiceFee.original,
                corrected: application.refundableServiceFee.corrected,
                final: application.refundableServiceFee.corrected !== undefined
                    ? application.refundableServiceFee.corrected
                    : calculation.refundableServiceFee.original,
            },
            earlySettlementPenalty: {
                original: calculation.earlySettlementPenalty.original,
                corrected: application.earlySettlementPenalty.corrected,
                final: application.earlySettlementPenalty.corrected !== undefined
                    ? application.earlySettlementPenalty.corrected
                    : calculation.earlySettlementPenalty.original,
            },
            totalPayableAmount: {
                original: calculation.totalPayableAmount.original,
                corrected: application.totalPayableAmount.corrected,
                final: application.totalPayableAmount.corrected !== undefined
                    ? application.totalPayableAmount.corrected
                    : calculation.totalPayableAmount.original,
            },
            reasons: {
                ...application.reasons,
                trialCalculation: [
                    ...application.reasons.trialCalculation,
                    ...calculation.reasons.trialCalculation,
                ],
                feeReversal: [
                    ...application.reasons.feeReversal,
                    ...calculation.reasons.feeReversal,
                ],
            },
        };
        return DataRepository_1.repository.updateApplication(updated, operator);
    }
    correctValue(applicationId, fieldName, correctedValue, correctedBy, correctionReason) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        if (!this.stateMachine.isCorrectionAllowed(application.status)) {
            throw new Error(`当前状态${application.status}不允许修正`);
        }
        return DataRepository_1.repository.correctValue(application, fieldName, correctedValue, correctedBy, correctionReason);
    }
    transitionStatus(applicationId, targetStatus, userRole, operator, remark) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        const result = this.stateMachine.transition(application, targetStatus, userRole, operator, remark);
        if (!result.success) {
            throw new Error(result.reason.message);
        }
        return DataRepository_1.repository.updateApplication(result.updatedApplication, operator);
    }
    updateRemark(applicationId, remark, operator) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        return DataRepository_1.repository.updateRemark(application, remark, operator);
    }
    resolveAnomaly(applicationId, anomalyType, resolvedBy, resolveReason) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        return this.anomalyDetector.resolveAnomaly(application, anomalyType, resolvedBy, resolveReason);
    }
    getApplication(applicationId) {
        return DataRepository_1.repository.getApplication(applicationId);
    }
    listApplications(filter) {
        if (filter) {
            return DataRepository_1.repository.filterApplications(filter);
        }
        return DataRepository_1.repository.getAllApplications();
    }
    getHistory(applicationId) {
        return DataRepository_1.repository.getHistory(applicationId);
    }
    createStatement(applicationId, createdBy) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        if (!['APPROVED', 'EXECUTED'].includes(application.status)) {
            throw new Error(`申请状态${application.status}不允许生成结清单`);
        }
        return DataRepository_1.repository.createStatement(application, createdBy);
    }
    getStatement(statementId) {
        return DataRepository_1.repository.getStatement(statementId);
    }
    exportApplications(filter, options) {
        const applications = DataRepository_1.repository.filterApplications(filter);
        if (options.format === 'CSV') {
            return ExportService_1.exportService.exportApplicationsToCsv(applications, options);
        }
        return ExportService_1.exportService.exportApplicationsToExcel(applications, options);
    }
    exportDetailedReport(applicationId) {
        const application = DataRepository_1.repository.getApplication(applicationId);
        if (!application) {
            throw new Error(`申请${applicationId}不存在`);
        }
        const statement = DataRepository_1.repository.getStatementByApplicationNo(application.applicationNo);
        return ExportService_1.exportService.exportDetailedApplication(application, statement);
    }
    getAvailableTransitions(status, userRole) {
        return this.stateMachine.getAvailableTransitions(status, userRole);
    }
}
exports.SettlementFacade = SettlementFacade;
exports.settlementFacade = new SettlementFacade();
//# sourceMappingURL=SettlementFacade.js.map