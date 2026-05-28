import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BusinessObject,
  Issue,
  AuditTrail,
  AuditAction,
  BusinessStatus,
  User,
  AuditConclusion,
  Contract,
  Invoice,
  RemittanceApplication,
  SupplementRecord,
} from '@/types';
import { mockBusinessObjects, currentUser, mockUsers } from '@/data/mockData';
import { canTransition, createAuditTrail } from '@/services/stateMachine';
import { runFullValidation, calculateRiskLevel } from '@/services/validationEngine';

interface BusinessState {
  businessObjects: BusinessObject[];
  currentUser: User;
  users: User[];
  selectedBusinessId: string | null;
  filters: {
    status?: BusinessStatus;
    riskLevel?: string;
    searchText?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  loading: boolean;
  error: string | null;
  getBusinessById: (id: string) => BusinessObject | undefined;
  getBusinessObjects: () => BusinessObject[];
  setSelectedBusiness: (id: string | null) => void;
  setFilters: (filters: Partial<BusinessState['filters']>) => void;
  performAction: (
    businessId: string,
    action: AuditAction,
    remark: string,
    additionalData?: Record<string, unknown>
  ) => Promise<{ success: boolean; message: string }>;
  resolveIssue: (
    businessId: string,
    issueId: string,
    resolution: string
  ) => void;
  ignoreIssue: (businessId: string, issueId: string) => void;
  addManualIssue: (
    businessId: string,
    description: string,
    severity: 'low' | 'medium' | 'high'
  ) => void;
  uploadSupplement: (
    businessId: string,
    type: 'contract' | 'invoice' | 'purpose',
    document: Partial<Contract | Invoice | RemittanceApplication>,
    reason: string,
    coversOriginal: boolean,
    originalDocumentId?: string
  ) => void;
  updatePurposeCode: (
    businessId: string,
    purposeCode: string,
    purposeName: string
  ) => void;
  exportConclusion: (businessId: string) => string;
  getFilteredBusiness: () => BusinessObject[];
  getStatistics: () => {
    total: number;
    pending: number;
    issue: number;
    confirmed: number;
    todayNew: number;
    byIssueType: Record<string, number>;
  };
  runValidation: (businessId: string) => void;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businessObjects: mockBusinessObjects,
      currentUser,
      users: mockUsers,
      selectedBusinessId: null,
      filters: {},
      loading: false,
      error: null,

      getBusinessById: (id) => {
        return get().businessObjects.find((bo) => bo.id === id);
      },

      getBusinessObjects: () => {
        return get().businessObjects;
      },

      setSelectedBusiness: (id) => {
        set({ selectedBusinessId: id });
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      performAction: async (businessId, action, remark, additionalData) => {
        const state = get();
        const business = state.businessObjects.find(
          (bo) => bo.id === businessId
        );

        if (!business) {
          return { success: false, message: '业务不存在' };
        }

        const transition = canTransition(
          business.status,
          action,
          state.currentUser.role
        );

        if (!transition.allowed) {
          return { success: false, message: transition.reason || '操作不允许' };
        }

        const toStatus = transition.toState || business.status;
        const trail = createAuditTrail(
          business,
          action,
          state.currentUser.name,
          remark,
          toStatus
        );

        let newStatus = toStatus;
        let newIssues = [...business.issues];

        if (action === 'submit' || action === 'recheck' || action === 'upload_supplement') {
          const validationResult = runFullValidation(
            business,
            state.businessObjects
          );
          newIssues = validationResult.issues.map((issue) => {
            const existing = business.issues.find((i) => i.id === issue.id);
            if (existing && existing.status === 'resolved') {
              return existing;
            }
            return issue;
          });

          const openIssues = newIssues.filter((i) => i.status === 'open');
          if (openIssues.length > 0) {
            const hasDuplicate = openIssues.some(
              (i) => i.type === 'duplicate_remittance'
            );
            newStatus = hasDuplicate ? 'duplicate_check' : 'issue_found';
            trail.toStatus = newStatus;
          }
        }

        const newConclusion: AuditConclusion | null =
          action === 'review_pass' || action === 'review_reject'
            ? {
                id: `conclusion-${Date.now()}`,
                businessNo: business.businessNo,
                result: action === 'review_pass' ? 'pass' : 'reject',
                remark,
                auditor: state.currentUser.name,
                auditTime: new Date().toISOString(),
                reviewer: null,
                reviewTime: null,
                isFinal: true,
              }
            : business.conclusion;

        const updatedBusiness: BusinessObject = {
          ...business,
          status: newStatus,
          riskLevel: calculateRiskLevel(newIssues),
          updatedAt: new Date().toISOString(),
          issues: newIssues,
          auditTrails: [...business.auditTrails, trail],
          conclusion: newConclusion,
          ...additionalData,
        };

        const newBusinessObjects = state.businessObjects.map((bo) =>
          bo.id === businessId ? updatedBusiness : bo
        );

        set({ businessObjects: newBusinessObjects });

        return {
          success: true,
          message: '操作成功',
        };
      },

      resolveIssue: (businessId, issueId, resolution) => {
        set((state) => {
          const business = state.businessObjects.find(
            (bo) => bo.id === businessId
          );
          if (!business) return state;

          const updatedIssues = business.issues.map((issue) =>
            issue.id === issueId
              ? {
                  ...issue,
                  status: 'resolved' as const,
                  resolution,
                  resolvedAt: new Date().toISOString(),
                  resolver: state.currentUser.name,
                }
              : issue
          );

          const trail: AuditTrail = {
            id: `trail-${Date.now()}`,
            businessNo: business.businessNo,
            action: 'detect_issue',
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            remark: `解决问题：${issueId}，${resolution}`,
            fromStatus: business.status,
            toStatus: business.status,
          };

          const updatedBusiness: BusinessObject = {
            ...business,
            issues: updatedIssues,
            riskLevel: calculateRiskLevel(updatedIssues),
            auditTrails: [...business.auditTrails, trail],
            updatedAt: new Date().toISOString(),
          };

          return {
            businessObjects: state.businessObjects.map((bo) =>
              bo.id === businessId ? updatedBusiness : bo
            ),
          };
        });
      },

      ignoreIssue: (businessId, issueId) => {
        set((state) => {
          const business = state.businessObjects.find(
            (bo) => bo.id === businessId
          );
          if (!business) return state;

          const updatedIssues = business.issues.map((issue) =>
            issue.id === issueId
              ? {
                  ...issue,
                  status: 'ignored' as const,
                  resolution: '人工忽略',
                  resolvedAt: new Date().toISOString(),
                  resolver: state.currentUser.name,
                }
              : issue
          );

          const trail: AuditTrail = {
            id: `trail-${Date.now()}`,
            businessNo: business.businessNo,
            action: 'detect_issue',
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            remark: `忽略问题：${issueId}`,
            fromStatus: business.status,
            toStatus: business.status,
          };

          const updatedBusiness: BusinessObject = {
            ...business,
            issues: updatedIssues,
            riskLevel: calculateRiskLevel(updatedIssues),
            auditTrails: [...business.auditTrails, trail],
            updatedAt: new Date().toISOString(),
          };

          return {
            businessObjects: state.businessObjects.map((bo) =>
              bo.id === businessId ? updatedBusiness : bo
            ),
          };
        });
      },

      addManualIssue: (businessId, description, severity) => {
        set((state) => {
          const business = state.businessObjects.find(
            (bo) => bo.id === businessId
          );
          if (!business) return state;

          const newIssue: Issue = {
            id: `issue-manual-${Date.now()}`,
            businessNo: business.businessNo,
            type: 'manual_marked',
            severity,
            description,
            detectedBy: 'manual',
            detectedAt: new Date().toISOString(),
            status: 'open',
            resolution: null,
            resolvedAt: null,
            resolver: null,
          };

          const trail: AuditTrail = {
            id: `trail-${Date.now()}`,
            businessNo: business.businessNo,
            action: 'detect_issue',
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            remark: `人工标注问题：${description}`,
            fromStatus: business.status,
            toStatus: 'issue_found',
          };

          const updatedBusiness: BusinessObject = {
            ...business,
            issues: [...business.issues, newIssue],
            status: 'issue_found',
            riskLevel: calculateRiskLevel([...business.issues, newIssue]),
            auditTrails: [...business.auditTrails, trail],
            updatedAt: new Date().toISOString(),
          };

          return {
            businessObjects: state.businessObjects.map((bo) =>
              bo.id === businessId ? updatedBusiness : bo
            ),
          };
        });
      },

      uploadSupplement: (
        businessId,
        type,
        document,
        reason,
        coversOriginal,
        originalDocumentId
      ) => {
        set((state) => {
          const business = state.businessObjects.find(
            (bo) => bo.id === businessId
          );
          if (!business) return state;

          const newVersion = business.currentVersion + 1;
          const docId = `${type}-${businessId}-v${newVersion}-${Date.now()}`;

          let newContracts = [...business.contracts];
          let newInvoices = [...business.invoices];
          let newApplications = [...business.applications];

          if (type === 'contract' && 'contractNo' in document) {
            const newContract: Contract = {
              id: docId,
              businessNo: business.businessNo,
              version: newVersion,
              contractNo: document.contractNo || '',
              contractDate: document.contractDate || '',
              amount: document.amount || 0,
              currency: document.currency || 'USD',
              goodsDescription: document.goodsDescription || '',
              signatoryA: document.signatoryA || '',
              signatoryB: document.signatoryB || '',
              isSupplement: true,
              uploader: state.currentUser.name,
              uploadTime: new Date().toISOString(),
            };
            newContracts = [...newContracts, newContract];
          }

          if (type === 'invoice' && 'invoiceNo' in document) {
            const newInvoice: Invoice = {
              id: docId,
              businessNo: business.businessNo,
              version: newVersion,
              invoiceNo: document.invoiceNo || '',
              invoiceDate: document.invoiceDate || '',
              amount: document.amount || 0,
              currency: document.currency || 'USD',
              goodsDescription: document.goodsDescription || '',
              sellerName: document.sellerName || '',
              buyerName: document.buyerName || '',
              isSupplement: true,
              uploader: state.currentUser.name,
              uploadTime: new Date().toISOString(),
            };
            newInvoices = [...newInvoices, newInvoice];
          }

          if (type === 'purpose' && 'purposeCode' in document) {
            const latestApp =
              business.applications[business.applications.length - 1];
            const newApp: RemittanceApplication = {
              ...latestApp,
              id: docId,
              version: newVersion,
              purposeCode: document.purposeCode || latestApp.purposeCode,
              purposeDescription:
                document.purposeDescription || latestApp.purposeDescription,
              amount: document.amount || latestApp.amount,
              submitter: state.currentUser.name,
              submitTime: new Date().toISOString(),
            };
            newApplications = [...newApplications, newApp];
          }

          const supplementRecord: SupplementRecord = {
            id: `supp-${businessId}-${Date.now()}`,
            businessNo: business.businessNo,
            version: newVersion,
            supplementType: type,
            originalDocumentId: originalDocumentId || '',
            newDocumentId: docId,
            reason,
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            coversOriginal,
          };

          const trail: AuditTrail = {
            id: `trail-${Date.now()}`,
            businessNo: business.businessNo,
            action: 'upload_supplement',
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            remark: `上传补件：${reason}`,
            fromStatus: business.status,
            toStatus: 'processing',
          };

          const updatedBusiness: BusinessObject = {
            ...business,
            currentVersion: newVersion,
            contracts: newContracts,
            invoices: newInvoices,
            applications: newApplications,
            supplementRecords: [...business.supplementRecords, supplementRecord],
            status: 'processing',
            auditTrails: [...business.auditTrails, trail],
            updatedAt: new Date().toISOString(),
            amount: newApplications[newApplications.length - 1]?.amount || business.amount,
          };

          return {
            businessObjects: state.businessObjects.map((bo) =>
              bo.id === businessId ? updatedBusiness : bo
            ),
          };
        });
      },

      updatePurposeCode: (businessId, purposeCode, purposeName) => {
        set((state) => {
          const business = state.businessObjects.find(
            (bo) => bo.id === businessId
          );
          if (!business) return state;

          const newVersion = business.currentVersion + 1;
          const latestApp =
            business.applications[business.applications.length - 1];

          const newApp: RemittanceApplication = {
            ...latestApp,
            id: `app-${businessId}-v${newVersion}-${Date.now()}`,
            version: newVersion,
            purposeCode,
            purposeDescription: purposeName,
            submitter: state.currentUser.name,
            submitTime: new Date().toISOString(),
          };

          const trail: AuditTrail = {
            id: `trail-${Date.now()}`,
            businessNo: business.businessNo,
            action: 'upload_supplement',
            operator: state.currentUser.name,
            operateTime: new Date().toISOString(),
            remark: `修改用途代码：${business.purposeCode} → ${purposeCode} (${purposeName})`,
            fromStatus: business.status,
            toStatus: 'processing',
          };

          const updatedBusiness: BusinessObject = {
            ...business,
            purposeCode,
            purposeName,
            currentVersion: newVersion,
            applications: [...business.applications, newApp],
            status: 'processing',
            auditTrails: [...business.auditTrails, trail],
            updatedAt: new Date().toISOString(),
          };

          return {
            businessObjects: state.businessObjects.map((bo) =>
              bo.id === businessId ? updatedBusiness : bo
            ),
          };
        });
      },

      exportConclusion: (businessId) => {
        const business = get().businessObjects.find(
          (bo) => bo.id === businessId
        );
        if (!business) return '';

        const conclusion = business.conclusion;
        if (!conclusion) return '';

        const issuesSummary = business.issues
          .map(
            (i) =>
              `- [${i.status === 'open' ? '待处理' : i.status === 'resolved' ? '已解决' : '已忽略'}] ${i.severity === 'high' ? '高' : i.severity === 'medium' ? '中' : '低'}风险 - ${i.description}`
          )
          .join('\n');

        const trailsSummary = business.auditTrails
          .map(
            (t) =>
              `- ${t.operateTime} | ${t.operator} | ${t.action} | ${t.remark}`
          )
          .join('\n');

        const report = `
跨境汇款用途核验报告
=====================================

业务编号：${business.businessNo}
客户名称：${business.customerName}
汇款金额：${business.amount.toLocaleString()} ${business.currency}
用途代码：${business.purposeCode} - ${business.purposeName}
业务状态：${business.status}
风险等级：${business.riskLevel === 'normal' ? '正常' : business.riskLevel === 'warning' ? '预警' : '高风险'}

审核结论
-------------------------------------
结果：${conclusion.result === 'pass' ? '通过' : conclusion.result === 'reject' ? '拒绝' : '补件'}
审核人：${conclusion.auditor}
审核时间：${conclusion.auditTime}
备注：${conclusion.remark}

问题清单
-------------------------------------
${issuesSummary || '无问题'}

审核轨迹
-------------------------------------
${trailsSummary}

材料清单
-------------------------------------
合同：${business.contracts.length}份
发票：${business.invoices.length}份
补件记录：${business.supplementRecords.length}次
版本号：v${business.currentVersion}

报告生成时间：${new Date().toISOString()}
        `.trim();

        return report;
      },

      getFilteredBusiness: () => {
        const state = get();
        let result = [...state.businessObjects];

        if (state.filters.status) {
          result = result.filter((bo) => bo.status === state.filters.status);
        }

        if (state.filters.riskLevel) {
          result = result.filter(
            (bo) => bo.riskLevel === state.filters.riskLevel
          );
        }

        if (state.filters.searchText) {
          const search = state.filters.searchText.toLowerCase();
          result = result.filter(
            (bo) =>
              bo.businessNo.toLowerCase().includes(search) ||
              bo.customerName.toLowerCase().includes(search)
          );
        }

        return result.sort((a, b) => {
          const statusOrder: Record<string, number> = {
            issue_found: 0,
            duplicate_check: 1,
            supplementing: 2,
            pending_review: 3,
            processing: 4,
            pending: 5,
            confirmed: 6,
            withdrawn: 7,
            rejected: 8,
            closed: 9,
          };
          return (
            (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
          );
        });
      },

      getStatistics: () => {
        const state = get();
        const { businessObjects } = state;
        const today = new Date().toISOString().split('T')[0];

        const byIssueType: Record<string, number> = {};

        businessObjects.forEach((bo) => {
          bo.issues
            .filter((i) => i.status === 'open')
            .forEach((issue) => {
              byIssueType[issue.type] = (byIssueType[issue.type] || 0) + 1;
            });
        });

        return {
          total: businessObjects.length,
          pending: businessObjects.filter(
            (bo) =>
              bo.status === 'pending' ||
              bo.status === 'processing' ||
              bo.status === 'pending_review'
          ).length,
          issue: businessObjects.filter(
            (bo) =>
              bo.status === 'issue_found' ||
              bo.status === 'supplementing' ||
              bo.status === 'duplicate_check'
          ).length,
          confirmed: businessObjects.filter((bo) => bo.status === 'confirmed')
            .length,
          todayNew: businessObjects.filter((bo) =>
            bo.createdAt.startsWith(today)
          ).length,
          byIssueType,
        };
      },

      runValidation: (businessId) => {
        const state = get();
        const business = state.businessObjects.find(
          (bo) => bo.id === businessId
        );
        if (!business) return;

        const validationResult = runFullValidation(
          business,
          state.businessObjects
        );

        const updatedIssues = validationResult.issues.map((newIssue) => {
          const existing = business.issues.find((i) => i.id === newIssue.id);
          if (existing && existing.status !== 'open') {
            return existing;
          }
          return newIssue;
        });

        const trail: AuditTrail = {
          id: `trail-${Date.now()}`,
          businessNo: business.businessNo,
          action: 'recheck',
          operator: 'system',
          operateTime: new Date().toISOString(),
          remark: `重新校验完成，发现 ${validationResult.issues.filter((i) => i.status === 'open').length} 个问题`,
          fromStatus: business.status,
          toStatus: business.status,
        };

        const updatedBusiness: BusinessObject = {
          ...business,
          issues: updatedIssues,
          riskLevel: calculateRiskLevel(updatedIssues),
          auditTrails: [...business.auditTrails, trail],
          updatedAt: new Date().toISOString(),
        };

        set({
          businessObjects: state.businessObjects.map((bo) =>
            bo.id === businessId ? updatedBusiness : bo
          ),
        });
      },
    }),
    {
      name: 'business-store',
      partialize: (state) => ({
        businessObjects: state.businessObjects,
      }),
    }
  )
);
