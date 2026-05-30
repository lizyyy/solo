"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repository = exports.DataRepository = void 0;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
class DataRepository {
    constructor() {
        this.applications = new Map();
        this.statements = new Map();
        this.histories = new Map();
        this.contracts = new Map();
        this.flows = new Map();
        this.overdues = new Map();
        this.feeRules = new Map();
        this.applicationNoCounter = 1000;
        this.statementNoCounter = 1000;
    }
    generateApplicationNo() {
        return `SQ${(0, dayjs_1.default)().format('YYYYMMDD')}${String(this.applicationNoCounter++).padStart(4, '0')}`;
    }
    generateStatementNo() {
        return `JD${(0, dayjs_1.default)().format('YYYYMMDD')}${String(this.statementNoCounter++).padStart(4, '0')}`;
    }
    saveContract(contract) {
        this.contracts.set(contract.contractNo, contract);
    }
    getContract(contractNo) {
        return this.contracts.get(contractNo);
    }
    saveFlows(contractNo, flows) {
        this.flows.set(contractNo, flows);
    }
    getFlows(contractNo) {
        return this.flows.get(contractNo) || [];
    }
    saveOverdues(contractNo, records) {
        this.overdues.set(contractNo, records);
    }
    getOverdues(contractNo) {
        return this.overdues.get(contractNo) || [];
    }
    saveFeeRule(rule) {
        this.feeRules.set(rule.ruleCode, rule);
    }
    getActiveFeeRule(contractType) {
        return Array.from(this.feeRules.values()).find((r) => r.isActive && r.contractType === contractType);
    }
    createApplication(data) {
        const now = (0, dayjs_1.default)().toISOString();
        const application = {
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
            createdBy: data.operator,
            updatedBy: data.operator,
            applicationNo: this.generateApplicationNo(),
            contractNo: data.contractNo,
            applicant: data.applicant,
            applicationDate: now,
            expectedSettlementDate: data.expectedSettlementDate || now,
            remainingPrincipal: { original: 0, final: 0 },
            remainingServiceFee: { original: 0, final: 0 },
            refundableServiceFee: { original: 0, final: 0 },
            earlySettlementPenalty: { original: 0, final: 0 },
            totalPayableAmount: { original: 0, final: 0 },
            settlementReason: data.settlementReason || '',
            remark: data.remark,
            status: 'DRAFT',
            anomalies: [],
            reasons: {
                trialCalculation: [],
                feeReversal: [],
                flowVerification: [],
                stateTransition: [],
            },
        };
        this.applications.set(application.id, application);
        this.histories.set(application.id, []);
        return application;
    }
    getApplication(id) {
        return this.applications.get(id);
    }
    getApplicationByNo(applicationNo) {
        return Array.from(this.applications.values()).find((a) => a.applicationNo === applicationNo);
    }
    getAllApplications() {
        return Array.from(this.applications.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    filterApplications(filter) {
        let results = this.getAllApplications();
        if (filter.contractNo) {
            results = results.filter((a) => a.contractNo.includes(filter.contractNo));
        }
        if (filter.status && filter.status.length > 0) {
            results = results.filter((a) => filter.status.includes(a.status));
        }
        if (filter.applicationDateFrom) {
            results = results.filter((a) => a.applicationDate >= filter.applicationDateFrom);
        }
        if (filter.applicationDateTo) {
            results = results.filter((a) => a.applicationDate <= filter.applicationDateTo);
        }
        if (filter.hasAnomalies !== undefined) {
            results = results.filter((a) => a.anomalies.filter((an) => !an.resolved).length > 0 === filter.hasAnomalies);
        }
        if (filter.anomalyTypes && filter.anomalyTypes.length > 0) {
            results = results.filter((a) => a.anomalies.some((an) => filter.anomalyTypes.includes(an.type)));
        }
        return results;
    }
    recordHistory(applicationId, applicationNo, fieldName, oldValue, newValue, changedBy, changeReason) {
        const history = {
            id: (0, uuid_1.v4)(),
            applicationNo,
            fieldName,
            oldValue,
            newValue,
            changedBy,
            changedAt: (0, dayjs_1.default)().toISOString(),
            changeReason,
        };
        const existing = this.histories.get(applicationId) || [];
        existing.push(history);
        this.histories.set(applicationId, existing);
    }
    correctValue(application, fieldName, correctedValue, correctedBy, correctionReason) {
        const oldValue = application[fieldName];
        const newValue = {
            original: oldValue.original,
            corrected: correctedValue,
            final: correctedValue,
        };
        this.recordHistory(application.id, application.applicationNo, fieldName, oldValue, newValue, correctedBy, correctionReason);
        const updated = {
            ...application,
            [fieldName]: newValue,
            updatedAt: (0, dayjs_1.default)().toISOString(),
            updatedBy: correctedBy,
        };
        this.applications.set(application.id, updated);
        return updated;
    }
    updateRemark(application, remark, updatedBy) {
        this.recordHistory(application.id, application.applicationNo, 'remark', application.remark, remark, updatedBy, '更新备注');
        const updated = {
            ...application,
            remark,
            updatedAt: (0, dayjs_1.default)().toISOString(),
            updatedBy,
        };
        this.applications.set(application.id, updated);
        return updated;
    }
    updateApplication(application, updatedBy) {
        const oldApp = this.applications.get(application.id);
        if (oldApp) {
            Object.keys(application).forEach((key) => {
                const k = key;
                if (JSON.stringify(oldApp[k]) !== JSON.stringify(application[k])) {
                    this.recordHistory(application.id, application.applicationNo, key, oldApp[k], application[k], updatedBy, '更新申请');
                }
            });
        }
        const updated = {
            ...application,
            updatedAt: (0, dayjs_1.default)().toISOString(),
            updatedBy,
        };
        this.applications.set(application.id, updated);
        return updated;
    }
    getHistory(applicationId) {
        return this.histories.get(applicationId) || [];
    }
    createStatement(application, createdBy) {
        const now = (0, dayjs_1.default)().toISOString();
        const flows = this.getFlows(application.contractNo);
        const overdues = this.getOverdues(application.contractNo);
        const statement = {
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
            createdBy,
            updatedBy: createdBy,
            statementNo: this.generateStatementNo(),
            applicationNo: application.applicationNo,
            contractNo: application.contractNo,
            originalSnapshot: {
                remainingPrincipal: application.remainingPrincipal.original,
                remainingServiceFee: application.remainingServiceFee.original,
                refundableServiceFee: application.refundableServiceFee.original,
                earlySettlementPenalty: application.earlySettlementPenalty.original,
                totalPayableAmount: application.totalPayableAmount.original,
                overdueRecords: overdues.map((o) => ({
                    recordNo: o.recordNo,
                    overdueDays: o.overdueDays.original,
                    overdueAmount: o.overdueAmount.original,
                })),
                repaymentFlows: flows.map((f) => ({
                    flowNo: f.flowNo,
                    termNo: f.termNo,
                    paidPrincipal: f.paidPrincipal,
                    paidServiceFee: f.paidServiceFee,
                })),
            },
            finalSnapshot: {
                remainingPrincipal: application.remainingPrincipal.final,
                remainingServiceFee: application.remainingServiceFee.final,
                refundableServiceFee: application.refundableServiceFee.final,
                earlySettlementPenalty: application.earlySettlementPenalty.final,
                totalPayableAmount: application.totalPayableAmount.final,
                conclusion: application.settlementReason || '提前结清',
            },
            anomalies: application.anomalies,
            isExported: false,
        };
        if (application.remainingPrincipal.corrected !== undefined ||
            application.remainingServiceFee.corrected !== undefined ||
            application.refundableServiceFee.corrected !== undefined ||
            application.earlySettlementPenalty.corrected !== undefined ||
            application.totalPayableAmount.corrected !== undefined) {
            statement.correctionSnapshot = {
                remainingPrincipal: application.remainingPrincipal.corrected,
                remainingServiceFee: application.remainingServiceFee.corrected,
                refundableServiceFee: application.refundableServiceFee.corrected,
                earlySettlementPenalty: application.earlySettlementPenalty.corrected,
                totalPayableAmount: application.totalPayableAmount.corrected,
                remark: application.remark,
                correctedBy: application.updatedBy,
                correctedAt: application.updatedAt,
            };
        }
        this.statements.set(statement.id, statement);
        return statement;
    }
    getStatement(id) {
        return this.statements.get(id);
    }
    getStatementByApplicationNo(applicationNo) {
        return Array.from(this.statements.values()).find((s) => s.applicationNo === applicationNo);
    }
    markAsExported(statementId, exportedBy) {
        const statement = this.statements.get(statementId);
        if (!statement)
            return undefined;
        const updated = {
            ...statement,
            isExported: true,
            exportedAt: (0, dayjs_1.default)().toISOString(),
            exportedBy,
            updatedAt: (0, dayjs_1.default)().toISOString(),
            updatedBy: exportedBy,
        };
        this.statements.set(statementId, updated);
        return updated;
    }
}
exports.DataRepository = DataRepository;
exports.repository = new DataRepository();
//# sourceMappingURL=DataRepository.js.map