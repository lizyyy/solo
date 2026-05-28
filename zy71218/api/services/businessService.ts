import {
  CaseDAO,
  InvoiceDAO,
  ConfirmationDAO,
  ContractDAO,
  RepaymentPlanDAO,
  CollectionNoteDAO,
  RiskReportDAO,
  LinkDAO,
} from '../dao/index.js';
import type {
  BusinessCase,
  BusinessLink,
  LinkGraph,
  LinkGraphNode,
  LinkGraphLink,
  PaginatedResponse,
} from '../../shared/types.js';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const businessService = {
  async getLinkGraph(businessNo?: string): Promise<LinkGraph> {
    const nodes: LinkGraphNode[] = [];
    const links: LinkGraphLink[] = [];

    if (businessNo) {
      const graph = await LinkDAO.getLinkGraph(businessNo);
      return graph as LinkGraph;
    }

    const { list: cases } = await CaseDAO.list({}, 1, 1000);
    for (const c of cases) {
      nodes.push({
        id: c.businessNo,
        type: 'case',
        name: c.businessNo,
        amount: c.totalAmount,
        status: c.currentStatus,
        date: c.createdAt,
      });
    }

    const { list: allLinks } = await LinkDAO.list({}, 1, 5000);
    const caseBusinessNos = new Set(cases.map(c => c.businessNo));

    for (const link of allLinks) {
      if (caseBusinessNos.has(link.sourceId) || caseBusinessNos.has(link.targetId)) {
        links.push({
          source: link.sourceId,
          target: link.targetId,
          linkType: link.linkType,
          confidence: link.confidence,
        });

        if (!nodes.find(n => n.id === link.sourceId) && !caseBusinessNos.has(link.sourceId)) {
          nodes.push({
            id: link.sourceId,
            type: link.sourceType,
            name: `${link.sourceType}-${link.sourceId}`,
            amount: 0,
            status: '',
            date: '',
          });
        }
        if (!nodes.find(n => n.id === link.targetId) && !caseBusinessNos.has(link.targetId)) {
          nodes.push({
            id: link.targetId,
            type: link.targetType,
            name: `${link.targetType}-${link.targetId}`,
            amount: 0,
            status: '',
            date: '',
          });
        }
      }
    }

    return { nodes, links };
  },

  async getFullLinkGraph(businessNo: string): Promise<LinkGraph> {
    const nodes: LinkGraphNode[] = [];
    const links: LinkGraphLink[] = [];

    const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
    if (!caseInfo) {
      return { nodes, links };
    }

    nodes.push({
      id: caseInfo.businessNo,
      type: 'case',
      name: caseInfo.businessNo,
      amount: caseInfo.totalAmount,
      status: caseInfo.currentStatus,
      date: caseInfo.createdAt,
    });

    const invoices = await InvoiceDAO.findByBusinessNo(businessNo);
    for (const inv of invoices) {
      nodes.push({
        id: inv.id,
        type: 'invoice',
        name: inv.invoiceNo,
        amount: inv.amount,
        status: inv.status,
        date: inv.issueDate,
      });
      links.push({ source: inv.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    const confirmations = await ConfirmationDAO.findByBusinessNo(businessNo);
    for (const conf of confirmations) {
      nodes.push({
        id: conf.id,
        type: 'confirmation',
        name: `确认-v${conf.version}`,
        amount: conf.confirmAmount,
        status: conf.status,
        date: conf.confirmDate,
      });
      links.push({ source: conf.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    const contracts = await ContractDAO.findByBusinessNo(businessNo);
    for (const contract of contracts) {
      nodes.push({
        id: contract.id,
        type: 'contract',
        name: contract.contractNo,
        amount: contract.financingAmount,
        status: contract.status,
        date: contract.startDate,
      });
      links.push({ source: contract.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    const plans = await RepaymentPlanDAO.findByBusinessNo(businessNo);
    for (const plan of plans) {
      nodes.push({
        id: plan.id,
        type: 'repayment_plan',
        name: `第${plan.instalmentNo}期`,
        amount: plan.principal + plan.interest,
        status: plan.status,
        date: plan.plannedDate,
      });
      links.push({ source: plan.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    const notes = await CollectionNoteDAO.findByBusinessNo(businessNo);
    for (const note of notes) {
      nodes.push({
        id: note.id,
        type: 'collection_note',
        name: `催收-${note.collectionDate}`,
        amount: 0,
        status: '',
        date: note.collectionDate,
      });
      links.push({ source: note.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    const reports = await RiskReportDAO.findByBusinessNo(businessNo);
    for (const report of reports) {
      nodes.push({
        id: report.id,
        type: 'risk_report',
        name: `风险报告-${report.reportDate}`,
        amount: 0,
        status: report.riskLevel,
        date: report.reportDate,
      });
      links.push({ source: report.id, target: businessNo, linkType: 'belongs_to', confidence: 100 });
    }

    if (invoices.length > 0 && confirmations.length > 0) {
      links.push({ source: invoices[0].id, target: confirmations[0].id, linkType: 'confirmed_by', confidence: 100 });
    }
    if (confirmations.length > 0 && contracts.length > 0) {
      links.push({ source: confirmations[0].id, target: contracts[0].id, linkType: 'secured_by', confidence: 100 });
    }
    if (contracts.length > 0 && plans.length > 0) {
      for (const plan of plans) {
        links.push({ source: contracts[0].id, target: plan.id, linkType: 'repay_schedule', confidence: 100 });
      }
    }

    return { nodes, links };
  },

  async getBusinessList(
    page: number = 1,
    pageSize: number = 10,
    filters?: any,
  ): Promise<PaginatedResponse<BusinessCase>> {
    const result = await CaseDAO.list(filters || {}, page, pageSize);
    return {
      list: result.list,
      total: result.total,
      page,
      pageSize,
    };
  },

  async getBusinessDetail(id: string): Promise<BusinessCase | null> {
    const byId = await CaseDAO.getById(id);
    if (byId) return byId;

    return await CaseDAO.findByBusinessNo(id);
  },

  async createLink(
    sourceId: string,
    sourceType: string,
    targetId: string,
    targetType: string,
    linkType: string,
    operatorId: string,
    operatorName: string,
  ): Promise<BusinessLink> {
    const id = generateId('link');
    const link = await LinkDAO.create({
      id,
      sourceId,
      sourceType: sourceType as any,
      targetId,
      targetType: targetType as any,
      linkType,
      confidence: 100,
    });
    return link;
  },

  async deleteLink(id: string): Promise<boolean> {
    return await LinkDAO.delete(id);
  },
};

export default businessService;
