import {
  CaseDAO,
  InvoiceDAO,
  ConfirmationDAO,
  ContractDAO,
  RepaymentPlanDAO,
  CollectionNoteDAO,
  StateTransitionDAO,
  LinkDAO,
  RiskReportDAO,
  RepaymentDAO,
} from '../dao/index.js';
import { auditService } from './auditService.js';
import { versionService } from './versionService.js';
import { stateMachineService } from './stateMachineService.js';
import { riskService } from './riskService.js';
import type {
  BusinessCase,
  CaseDetail,
  CaseStatus,
  LinkGraph,
  PaginatedResponse,
  User,
} from '../../shared/types.js';

export const caseService = {
  async getCaseList(
    filters?: Record<string, any>,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<BusinessCase>> {
    if (page < 1) {
      throw new Error('页码必须大于0');
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new Error('每页条数必须在1-100之间');
    }

    return await CaseDAO.list(filters, page, pageSize);
  },

  async getCaseDetail(id: string): Promise<CaseDetail> {
    if (!id) {
      throw new Error('案件ID不能为空');
    }

    let caseInfo = await CaseDAO.getById(id);
    
    if (!caseInfo) {
      caseInfo = await CaseDAO.findByBusinessNo(id);
    }

    if (!caseInfo) {
      throw new Error(`案件不存在: ${id}`);
    }

    const [invoices, confirmations, contracts, repaymentPlans, collectionNotes, stateTransitions, riskReports, repayments] = await Promise.all([
      InvoiceDAO.findByBusinessNo(caseInfo.businessNo),
      ConfirmationDAO.findByBusinessNo(caseInfo.businessNo),
      ContractDAO.findByBusinessNo(caseInfo.businessNo),
      RepaymentPlanDAO.findByBusinessNo(caseInfo.businessNo),
      CollectionNoteDAO.findByBusinessNo(caseInfo.businessNo),
      StateTransitionDAO.findByBusinessNo(caseInfo.businessNo),
      RiskReportDAO.findByBusinessNo(caseInfo.businessNo),
      RepaymentDAO.findByBusinessNo(caseInfo.businessNo),
    ]);

    return {
      caseInfo,
      invoice: invoices[0] || null,
      confirmation: confirmations[0] || null,
      contract: contracts[0] || null,
      repaymentPlans,
      collectionNotes,
      riskReports,
      transitions: stateTransitions,
      repayments,
    };
  },

  async getCaseByBusinessNo(businessNo: string): Promise<BusinessCase | null> {
    if (!businessNo) {
      throw new Error('业务编号不能为空');
    }

    return await CaseDAO.findByBusinessNo(businessNo);
  },

  async updateCaseStatus(
    businessNo: string,
    toStatus: CaseStatus,
    reason: string,
    impactScope: string,
    nextStep: string,
    operator: User
  ): Promise<void> {
    if (!businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!toStatus) {
      throw new Error('目标状态不能为空');
    }
    if (!reason) {
      throw new Error('变更原因不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
    if (!caseInfo) {
      throw new Error(`案件不存在: ${businessNo}`);
    }

    if (!stateMachineService.validateTransition(caseInfo.currentStatus, toStatus)) {
      throw new Error(`不允许的状态流转: ${caseInfo.currentStatus} -> ${toStatus}`);
    }

    const transitionType = stateMachineService.getTransitionType(caseInfo.currentStatus, toStatus);
    const nextSteps = stateMachineService.getNextSteps(caseInfo.currentStatus, toStatus);

    const beforeData = { ...caseInfo };

    await stateMachineService.validateAndLogTransition(
      caseInfo.currentStatus,
      toStatus,
      businessNo,
      reason,
      impactScope,
      operator
    );

    const newRiskLevel = riskService.calculateRiskLevel({
      ...caseInfo,
      currentStatus: toStatus,
    });

    await CaseDAO.updateStatus(businessNo, toStatus, newRiskLevel);

    const afterData = {
      ...caseInfo,
      currentStatus: toStatus,
      riskLevel: newRiskLevel,
    };

    await versionService.saveVersion(
      businessNo,
      'invoice',
      beforeData,
      afterData,
      operator,
      reason
    );

    await auditService.logAction(
      operator.id,
      operator.name,
      'update_case_status',
      'case',
      businessNo,
      `状态变更: ${caseInfo.currentStatus} -> ${toStatus}，原因: ${reason}`,
    );
  },

  async getCaseLinks(businessNo: string): Promise<LinkGraph> {
    if (!businessNo) {
      throw new Error('业务编号不能为空');
    }

    const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
    if (!caseInfo) {
      throw new Error(`案件不存在: ${businessNo}`);
    }

    return await LinkDAO.getLinkGraph(businessNo);
  },
};

export default caseService;
