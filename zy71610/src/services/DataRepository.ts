import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  SettlementApplication,
  SettlementStatement,
  SettlementHistory,
  SettlementFilter,
  VersionedValue,
  Currency,
  InstallmentContract,
  RepaymentFlow,
  OverdueRecord,
  FeeRule,
} from '../types/models';

export class DataRepository {
  private applications: Map<string, SettlementApplication> = new Map();
  private statements: Map<string, SettlementStatement> = new Map();
  private histories: Map<string, SettlementHistory[]> = new Map();
  private contracts: Map<string, InstallmentContract> = new Map();
  private flows: Map<string, RepaymentFlow[]> = new Map();
  private overdues: Map<string, OverdueRecord[]> = new Map();
  private feeRules: Map<string, FeeRule> = new Map();

  private applicationNoCounter = 1000;
  private statementNoCounter = 1000;

  private generateApplicationNo(): string {
    return `SQ${dayjs().format('YYYYMMDD')}${String(this.applicationNoCounter++).padStart(4, '0')}`;
  }

  private generateStatementNo(): string {
    return `JD${dayjs().format('YYYYMMDD')}${String(this.statementNoCounter++).padStart(4, '0')}`;
  }

  saveContract(contract: InstallmentContract): void {
    this.contracts.set(contract.contractNo, contract);
  }

  getContract(contractNo: string): InstallmentContract | undefined {
    return this.contracts.get(contractNo);
  }

  saveFlows(contractNo: string, flows: RepaymentFlow[]): void {
    this.flows.set(contractNo, flows);
  }

  getFlows(contractNo: string): RepaymentFlow[] {
    return this.flows.get(contractNo) || [];
  }

  saveOverdues(contractNo: string, records: OverdueRecord[]): void {
    this.overdues.set(contractNo, records);
  }

  getOverdues(contractNo: string): OverdueRecord[] {
    return this.overdues.get(contractNo) || [];
  }

  saveFeeRule(rule: FeeRule): void {
    this.feeRules.set(rule.ruleCode, rule);
  }

  getActiveFeeRule(contractType: string): FeeRule | undefined {
    return Array.from(this.feeRules.values()).find(
      (r) => r.isActive && r.contractType === contractType,
    );
  }

  createApplication(
    data: Partial<SettlementApplication> & {
      contractNo: string;
      applicant: string;
      operator: string;
    },
  ): SettlementApplication {
    const now = dayjs().toISOString();
    const application: SettlementApplication = {
      id: uuidv4(),
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

  getApplication(id: string): SettlementApplication | undefined {
    return this.applications.get(id);
  }

  getApplicationByNo(applicationNo: string): SettlementApplication | undefined {
    return Array.from(this.applications.values()).find(
      (a) => a.applicationNo === applicationNo,
    );
  }

  getAllApplications(): SettlementApplication[] {
    return Array.from(this.applications.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  filterApplications(filter: SettlementFilter): SettlementApplication[] {
    let results = this.getAllApplications();

    if (filter.contractNo) {
      results = results.filter((a) =>
        a.contractNo.includes(filter.contractNo!),
      );
    }

    if (filter.status && filter.status.length > 0) {
      results = results.filter((a) => filter.status!.includes(a.status));
    }

    if (filter.applicationDateFrom) {
      results = results.filter(
        (a) => a.applicationDate >= filter.applicationDateFrom!,
      );
    }

    if (filter.applicationDateTo) {
      results = results.filter(
        (a) => a.applicationDate <= filter.applicationDateTo!,
      );
    }

    if (filter.hasAnomalies !== undefined) {
      results = results.filter(
        (a) => a.anomalies.filter((an) => !an.resolved).length > 0 === filter.hasAnomalies,
      );
    }

    if (filter.anomalyTypes && filter.anomalyTypes.length > 0) {
      results = results.filter((a) =>
        a.anomalies.some((an) => filter.anomalyTypes!.includes(an.type)),
      );
    }

    return results;
  }

  private recordHistory(
    applicationId: string,
    applicationNo: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
    changedBy: string,
    changeReason: string,
  ): void {
    const history: SettlementHistory = {
      id: uuidv4(),
      applicationNo,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changedAt: dayjs().toISOString(),
      changeReason,
    };

    const existing = this.histories.get(applicationId) || [];
    existing.push(history);
    this.histories.set(applicationId, existing);
  }

  correctValue(
    application: SettlementApplication,
    fieldName:
      | 'remainingPrincipal'
      | 'remainingServiceFee'
      | 'refundableServiceFee'
      | 'earlySettlementPenalty'
      | 'totalPayableAmount',
    correctedValue: Currency,
    correctedBy: string,
    correctionReason: string,
  ): SettlementApplication {
    const oldValue = application[fieldName];
    const newValue: VersionedValue<Currency> = {
      original: oldValue.original,
      corrected: correctedValue,
      final: correctedValue,
    };

    this.recordHistory(
      application.id,
      application.applicationNo,
      fieldName,
      oldValue,
      newValue,
      correctedBy,
      correctionReason,
    );

    const updated: SettlementApplication = {
      ...application,
      [fieldName]: newValue,
      updatedAt: dayjs().toISOString(),
      updatedBy: correctedBy,
    };

    this.applications.set(application.id, updated);
    return updated;
  }

  updateRemark(
    application: SettlementApplication,
    remark: string,
    updatedBy: string,
  ): SettlementApplication {
    this.recordHistory(
      application.id,
      application.applicationNo,
      'remark',
      application.remark,
      remark,
      updatedBy,
      '更新备注',
    );

    const updated: SettlementApplication = {
      ...application,
      remark,
      updatedAt: dayjs().toISOString(),
      updatedBy,
    };

    this.applications.set(application.id, updated);
    return updated;
  }

  updateApplication(
    application: SettlementApplication,
    updatedBy: string,
  ): SettlementApplication {
    const oldApp = this.applications.get(application.id);
    if (oldApp) {
      Object.keys(application).forEach((key) => {
        const k = key as keyof SettlementApplication;
        if (JSON.stringify(oldApp[k]) !== JSON.stringify(application[k])) {
          this.recordHistory(
            application.id,
            application.applicationNo,
            key,
            oldApp[k],
            application[k],
            updatedBy,
            '更新申请',
          );
        }
      });
    }

    const updated = {
      ...application,
      updatedAt: dayjs().toISOString(),
      updatedBy,
    };

    this.applications.set(application.id, updated);
    return updated;
  }

  getHistory(applicationId: string): SettlementHistory[] {
    return this.histories.get(applicationId) || [];
  }

  createStatement(
    application: SettlementApplication,
    createdBy: string,
  ): SettlementStatement {
    const now = dayjs().toISOString();
    const flows = this.getFlows(application.contractNo);
    const overdues = this.getOverdues(application.contractNo);

    const statement: SettlementStatement = {
      id: uuidv4(),
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

    if (
      application.remainingPrincipal.corrected !== undefined ||
      application.remainingServiceFee.corrected !== undefined ||
      application.refundableServiceFee.corrected !== undefined ||
      application.earlySettlementPenalty.corrected !== undefined ||
      application.totalPayableAmount.corrected !== undefined
    ) {
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

  getStatement(id: string): SettlementStatement | undefined {
    return this.statements.get(id);
  }

  getStatementByApplicationNo(applicationNo: string): SettlementStatement | undefined {
    return Array.from(this.statements.values()).find(
      (s) => s.applicationNo === applicationNo,
    );
  }

  markAsExported(
    statementId: string,
    exportedBy: string,
  ): SettlementStatement | undefined {
    const statement = this.statements.get(statementId);
    if (!statement) return undefined;

    const updated: SettlementStatement = {
      ...statement,
      isExported: true,
      exportedAt: dayjs().toISOString(),
      exportedBy,
      updatedAt: dayjs().toISOString(),
      updatedBy: exportedBy,
    };

    this.statements.set(statementId, updated);
    return updated;
  }
}

export const repository = new DataRepository();
