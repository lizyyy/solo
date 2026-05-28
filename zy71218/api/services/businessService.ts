import type {
  BusinessCase,
  Invoice,
  Confirmation,
  FactoringContract,
  RepaymentPlan,
  BusinessLink,
  LinkGraph,
  LinkGraphNode,
  LinkGraphLink,
  PaginatedResponse,
} from '../../shared/types.js';

const mockCases: BusinessCase[] = [
  {
    id: 'c001',
    businessNo: 'BIZ2024001',
    buyerName: 'ABC贸易有限公司',
    sellerName: 'XYZ供应链有限公司',
    totalAmount: 500000,
    financingAmount: 400000,
    currentStatus: 'overdue',
    overdueDays: 30,
    riskLevel: 'high',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'c002',
    businessNo: 'BIZ2024002',
    buyerName: 'DEF科技有限公司',
    sellerName: 'XYZ供应链有限公司',
    totalAmount: 800000,
    financingAmount: 640000,
    currentStatus: 'normal_repayment',
    overdueDays: 0,
    riskLevel: 'low',
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv001',
    businessNo: 'BIZ2024001',
    invoiceNo: 'INV-2024-0001',
    sellerName: 'XYZ供应链有限公司',
    amount: 500000,
    taxAmount: 65000,
    goodsDescription: '电子产品一批',
    issueDate: '2024-01-10T00:00:00Z',
    dueDate: '2024-02-10T00:00:00Z',
    status: 'confirmed',
    version: 1,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
];

const mockConfirmations: Confirmation[] = [
  {
    id: 'conf001',
    businessNo: 'BIZ2024001',
    confirmDate: '2024-01-12T00:00:00Z',
    confirmAmount: 500000,
    goodsReceived: true,
    qualityIssue: false,
    qualityIssueDesc: '',
    confirmer: '李经理',
    isWithdrawn: false,
    withdrawReason: '',
    withdrawDate: '',
    status: 'confirmed',
    version: 1,
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
];

const mockContracts: FactoringContract[] = [
  {
    id: 'contract001',
    businessNo: 'BIZ2024001',
    contractNo: 'FA-2024-0001',
    factoringRate: 0.08,
    financingAmount: 400000,
    startDate: '2024-01-15T00:00:00Z',
    endDate: '2024-07-15T00:00:00Z',
    status: 'active',
    version: 1,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
];

const mockRepaymentPlans: RepaymentPlan[] = [
  {
    id: 'plan001',
    businessNo: 'BIZ2024001',
    instalmentNo: 1,
    principal: 200000,
    interest: 8000,
    plannedDate: '2024-03-15T00:00:00Z',
    status: 'pending',
    version: 1,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
];

const mockLinks: BusinessLink[] = [
  {
    id: 'link001',
    sourceId: 'c001',
    sourceType: 'invoice',
    targetId: 'inv001',
    targetType: 'invoice',
    linkType: 'belongs_to',
    confidence: 1.0,
    createdAt: '2024-01-15T00:00:00Z',
  },
];

export const businessService = {
  async getLinkGraph(businessNo?: string): Promise<LinkGraph> {
    const nodes: LinkGraphNode[] = [];
    const links: LinkGraphLink[] = [];

    mockCases.forEach((c) => {
      if (!businessNo || c.businessNo === businessNo) {
        nodes.push({
          id: c.id,
          type: 'case',
          name: c.businessNo,
          amount: c.totalAmount,
          status: c.currentStatus,
          date: c.createdAt,
        });
      }
    });

    mockInvoices.forEach((inv) => {
      if (!businessNo || inv.businessNo === businessNo) {
        nodes.push({
          id: inv.id,
          type: 'invoice',
          name: inv.invoiceNo,
          amount: inv.amount,
          status: inv.status,
          date: inv.issueDate,
        });
      }
    });

    mockConfirmations.forEach((conf) => {
      if (!businessNo || conf.businessNo === businessNo) {
        nodes.push({
          id: conf.id,
          type: 'confirmation',
          name: `确认-${conf.businessNo}`,
          amount: conf.confirmAmount,
          status: conf.status,
          date: conf.confirmDate,
        });
      }
    });

    mockContracts.forEach((contract) => {
      if (!businessNo || contract.businessNo === businessNo) {
        nodes.push({
          id: contract.id,
          type: 'contract',
          name: contract.contractNo,
          amount: contract.financingAmount,
          status: contract.status,
          date: contract.startDate,
        });
      }
    });

    mockLinks.forEach((link) => {
      if (nodes.find((n) => n.id === link.sourceId) && nodes.find((n) => n.id === link.targetId)) {
        links.push({
          source: link.sourceId,
          target: link.targetId,
          linkType: link.linkType,
          confidence: link.confidence,
        });
      }
    });

    return { nodes, links };
  },

  async getBusinessList(
    page: number = 1,
    pageSize: number = 10,
    filters?: any,
  ): Promise<PaginatedResponse<BusinessCase>> {
    let filtered = [...mockCases];

    if (filters?.status) {
      filtered = filtered.filter((c) => c.currentStatus === filters.status);
    }

    if (filters?.riskLevel) {
      filtered = filtered.filter((c) => c.riskLevel === filters.riskLevel);
    }

    if (filters?.keyword) {
      const kw = filters.keyword.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.businessNo.toLowerCase().includes(kw) ||
          c.buyerName.toLowerCase().includes(kw) ||
          c.sellerName.toLowerCase().includes(kw),
      );
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  },

  async getBusinessDetail(id: string): Promise<BusinessCase | null> {
    return mockCases.find((c) => c.id === id || c.businessNo === id) || null;
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
    const newLink: BusinessLink = {
      id: `link${Date.now()}`,
      sourceId,
      sourceType: sourceType as any,
      targetId,
      targetType: targetType as any,
      linkType,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
    };

    mockLinks.push(newLink);
    return newLink;
  },

  async deleteLink(id: string): Promise<boolean> {
    const index = mockLinks.findIndex((l) => l.id === id);
    if (index !== -1) {
      mockLinks.splice(index, 1);
      return true;
    }
    return false;
  },
};
