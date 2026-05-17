import { v4 as uuidv4 } from 'uuid';
import { FeatureFlag, ExplanationReport, EvaluationContext, EvaluationStatus, OverrideSource, OverrideLink } from '../models/types';

class DataStore {
  private flags: Map<string, FeatureFlag> = new Map();
  private reports: Map<string, ExplanationReport> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const flag1: FeatureFlag = {
      id: uuidv4(),
      name: 'new_checkout_flow',
      description: '新结账流程功能开关',
      defaultValue: false,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentRules: [
        {
          id: uuidv4(),
          name: '生产环境默认关闭',
          environment: 'production',
          enabled: true,
          priority: 10,
          conditions: { enabled: false }
        },
        {
          id: uuidv4(),
          name: '测试环境默认开启',
          environment: 'staging',
          enabled: true,
          priority: 10,
          conditions: { enabled: true }
        }
      ],
      userGroups: [
        {
          id: uuidv4(),
          name: '内部测试用户组',
          conditions: {
            domains: ['company.com'],
            userIds: ['test-user-1', 'test-user-2']
          },
          priority: 100,
          enabled: true
        },
        {
          id: uuidv4(),
          name: 'VIP客户组',
          conditions: {
            attributes: { vipLevel: ['gold', 'platinum'] }
          },
          priority: 90,
          enabled: true
        }
      ],
      rolloutPercentage: 10
    };

    const flag2: FeatureFlag = {
      id: uuidv4(),
      name: 'ai_support_chat',
      description: 'AI客服聊天功能',
      defaultValue: true,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentRules: [
        {
          id: uuidv4(),
          name: '所有环境开启',
          environment: '*',
          enabled: true,
          priority: 5,
          conditions: { enabled: true }
        }
      ],
      userGroups: [],
      rolloutPercentage: 100
    };

    this.flags.set(flag1.name, flag1);
    this.flags.set(flag2.name, flag2);
  }

  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  createReport(context: EvaluationContext, rawInput: string): ExplanationReport {
    const report: ExplanationReport = {
      id: uuidv4(),
      context,
      status: EvaluationStatus.PENDING,
      finalValue: false,
      overrideChain: [],
      matchedRules: [],
      matchedGroups: [],
      rawInput,
      processingLog: [`[${new Date().toISOString()}] 报告创建成功，初始状态: PENDING`],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.reports.set(report.id, report);
    return report;
  }

  getReport(id: string): ExplanationReport | undefined {
    return this.reports.get(id);
  }

  updateReport(id: string, updates: Partial<ExplanationReport>): ExplanationReport | undefined {
    const report = this.reports.get(id);
    if (!report) return undefined;
    
    const updated = {
      ...report,
      ...updates,
      updatedAt: new Date()
    };
    this.reports.set(id, updated);
    return updated;
  }

  addProcessingLog(reportId: string, message: string): void {
    const report = this.reports.get(reportId);
    if (report) {
      report.processingLog.push(`[${new Date().toISOString()}] ${message}`);
      report.updatedAt = new Date();
    }
  }

  addOverrideLink(reportId: string, link: OverrideLink): void {
    const report = this.reports.get(reportId);
    if (report) {
      report.overrideChain.push(link);
      report.finalValue = link.newValue;
      report.updatedAt = new Date();
    }
  }

  queryReports(params: {
    flagName?: string;
    tenantId?: string;
    userId?: string;
    status?: EvaluationStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): { data: ExplanationReport[]; total: number } {
    let results = Array.from(this.reports.values());

    if (params.flagName) {
      results = results.filter(r => r.context.flagName === params.flagName);
    }
    if (params.tenantId) {
      results = results.filter(r => r.context.tenantId === params.tenantId);
    }
    if (params.userId) {
      results = results.filter(r => r.context.userId === params.userId);
    }
    if (params.status) {
      results = results.filter(r => r.status === params.status);
    }
    if (params.startDate) {
      results = results.filter(r => r.createdAt >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter(r => r.createdAt <= params.endDate!);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: results.slice(start, end),
      total
    };
  }

  getAllReports(): ExplanationReport[] {
    return Array.from(this.reports.values());
  }
}

export const dataStore = new DataStore();
