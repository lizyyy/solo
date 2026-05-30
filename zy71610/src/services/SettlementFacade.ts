import dayjs from 'dayjs';
import {
  SettlementApplication,
  SettlementStatement,
  SettlementFilter,
  ExportOptions,
} from '../types/models';
import { repository } from './DataRepository';
import { SettlementCalculator } from './SettlementCalculator';
import { SettlementStateMachine } from './SettlementStateMachine';
import { FlowVerifier } from './FlowVerifier';
import { AnomalyDetector } from './AnomalyDetector';
import { exportService } from './ExportService';

export class SettlementFacade {
  private calculator = new SettlementCalculator();
  private stateMachine = new SettlementStateMachine();
  private flowVerifier = new FlowVerifier();
  private anomalyDetector = new AnomalyDetector();

  createSettlementApplication(
    contractNo: string,
    applicant: string,
    settlementReason: string,
    operator: string,
    expectedSettlementDate?: string,
  ): SettlementApplication {
    const contract = repository.getContract(contractNo);
    if (!contract) {
      throw new Error(`合同${contractNo}不存在`);
    }

    const flows = repository.getFlows(contractNo);
    const overdues = repository.getOverdues(contractNo);
    const feeRule = repository.getActiveFeeRule('CONSUMPTION');

    if (!feeRule) {
      throw new Error('未找到生效的费用规则');
    }

    let application = repository.createApplication({
      contractNo,
      applicant,
      operator,
      settlementReason,
      expectedSettlementDate: expectedSettlementDate || dayjs().toISOString(),
    });

    const flowResult = this.flowVerifier.verifyFlows(contract, flows);
    const calculation = this.calculator.calculateSettlement(
      contract,
      flows,
      overdues,
      feeRule,
      application.expectedSettlementDate,
      operator,
    );

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

    const existingApps = repository.getAllApplications();
    const anomalyResult = this.anomalyDetector.detectAll(
      application,
      overdues,
      existingApps,
    );

    application.anomalies = [...application.anomalies, ...anomalyResult.anomalies];
    application.reasons.trialCalculation = [
      ...application.reasons.trialCalculation,
      ...anomalyResult.reasons,
    ];

    return repository.updateApplication(application, operator);
  }

  recalculateSettlement(
    applicationId: string,
    operator: string,
  ): SettlementApplication {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    if (!this.stateMachine.isEditable(application.status)) {
      throw new Error(`当前状态${application.status}不允许重新试算`);
    }

    const contract = repository.getContract(application.contractNo);
    if (!contract) {
      throw new Error(`合同${application.contractNo}不存在`);
    }

    const flows = repository.getFlows(application.contractNo);
    const overdues = repository.getOverdues(application.contractNo);
    const feeRule = repository.getActiveFeeRule('CONSUMPTION');

    if (!feeRule) {
      throw new Error('未找到生效的费用规则');
    }

    const calculation = this.calculator.calculateSettlement(
      contract,
      flows,
      overdues,
      feeRule,
      application.expectedSettlementDate,
      operator,
    );

    const updated: SettlementApplication = {
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

    return repository.updateApplication(updated, operator);
  }

  correctValue(
    applicationId: string,
    fieldName:
      | 'remainingPrincipal'
      | 'remainingServiceFee'
      | 'refundableServiceFee'
      | 'earlySettlementPenalty'
      | 'totalPayableAmount',
    correctedValue: number,
    correctedBy: string,
    correctionReason: string,
  ): SettlementApplication {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    if (!this.stateMachine.isCorrectionAllowed(application.status)) {
      throw new Error(`当前状态${application.status}不允许修正`);
    }

    return repository.correctValue(
      application,
      fieldName,
      correctedValue,
      correctedBy,
      correctionReason,
    );
  }

  transitionStatus(
    applicationId: string,
    targetStatus: string,
    userRole: string,
    operator: string,
    remark?: string,
  ): SettlementApplication {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    const result = this.stateMachine.transition(
      application,
      targetStatus as any,
      userRole,
      operator,
      remark,
    );

    if (!result.success) {
      throw new Error(result.reason.message);
    }

    return repository.updateApplication(result.updatedApplication, operator);
  }

  updateRemark(
    applicationId: string,
    remark: string,
    operator: string,
  ): SettlementApplication {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    return repository.updateRemark(application, remark, operator);
  }

  resolveAnomaly(
    applicationId: string,
    anomalyType: string,
    resolvedBy: string,
    resolveReason: string,
  ): SettlementApplication {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    return this.anomalyDetector.resolveAnomaly(
      application,
      anomalyType,
      resolvedBy,
      resolveReason,
    );
  }

  getApplication(applicationId: string): SettlementApplication | undefined {
    return repository.getApplication(applicationId);
  }

  listApplications(filter?: SettlementFilter): SettlementApplication[] {
    if (filter) {
      return repository.filterApplications(filter);
    }
    return repository.getAllApplications();
  }

  getHistory(applicationId: string) {
    return repository.getHistory(applicationId);
  }

  createStatement(applicationId: string, createdBy: string): SettlementStatement {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    if (!['APPROVED', 'EXECUTED'].includes(application.status)) {
      throw new Error(`申请状态${application.status}不允许生成结清单`);
    }

    return repository.createStatement(application, createdBy);
  }

  getStatement(statementId: string) {
    return repository.getStatement(statementId);
  }

  exportApplications(
    filter: SettlementFilter,
    options: ExportOptions,
  ): string | Buffer {
    const applications = repository.filterApplications(filter);

    if (options.format === 'CSV') {
      return exportService.exportApplicationsToCsv(applications, options);
    }
    return exportService.exportApplicationsToExcel(applications, options);
  }

  exportDetailedReport(applicationId: string): string {
    const application = repository.getApplication(applicationId);
    if (!application) {
      throw new Error(`申请${applicationId}不存在`);
    }

    const statement = repository.getStatementByApplicationNo(application.applicationNo);
    return exportService.exportDetailedApplication(application, statement);
  }

  getAvailableTransitions(status: string, userRole: string) {
    return this.stateMachine.getAvailableTransitions(
      status as any,
      userRole,
    );
  }
}

export const settlementFacade = new SettlementFacade();
