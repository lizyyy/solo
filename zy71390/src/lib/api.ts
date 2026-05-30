import type {
  RateLimitRule,
  RuleVersion,
  Customer,
  HitResult,
  Anomaly,
  DrillReport,
  ModificationLog,
  DashboardStats,
  CreateRuleRequest,
  UpdateRuleRequest,
  DrillConfig,
  AddWhitelistRequest,
  ResolveAnomalyRequest,
  Tier,
  EntityType,
} from '../../shared/types';

const baseURL = 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseURL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const result = (await response.json()) as ApiResponse<T>;

  if (!result.success) {
    throw new Error(result.error || '请求失败');
  }

  return result.data as T;
}

export const api = {
  getRules: (): Promise<RateLimitRule[]> =>
    request<RateLimitRule[]>('/rules'),

  getRule: (id: string): Promise<RateLimitRule> =>
    request<RateLimitRule>(`/rules/${id}`),

  createRule: (data: CreateRuleRequest): Promise<RateLimitRule> =>
    request<RateLimitRule>('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRule: (
    id: string,
    data: UpdateRuleRequest
  ): Promise<RateLimitRule> =>
    request<RateLimitRule>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getRuleVersions: (ruleId: string): Promise<RuleVersion[]> =>
    request<RuleVersion[]>(`/rules/${ruleId}/versions`),

  rollbackRule: (
    ruleId: string,
    version: number,
    reason: string
  ): Promise<RateLimitRule> =>
    request<RateLimitRule>(`/rules/${ruleId}/rollback/${version}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getCustomers: (): Promise<Customer[]> =>
    request<Customer[]>('/customers'),

  updateCustomerTier: (
    customerId: string,
    tier: Tier,
    reason: string
  ): Promise<Customer> =>
    request<Customer>(`/customers/${customerId}/tier`, {
      method: 'PUT',
      body: JSON.stringify({ tier, reason }),
    }),

  getWhitelist: (): Promise<Customer[]> =>
    request<Customer[]>('/customers/whitelist'),

  addWhitelist: (data: AddWhitelistRequest): Promise<Customer> =>
    request<Customer>('/customers/whitelist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeWhitelist: (id: string, reason: string): Promise<{ message: string }> =>
    request<{ message: string }>(`/customers/whitelist/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  runDrill: (config: DrillConfig): Promise<DrillReport> =>
    request<DrillReport>('/shadow/drill', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getDrillResult: (id: string): Promise<DrillReport> =>
    request<DrillReport>(`/shadow/drill/${id}`),

  getHitAnalysis: (params: {
    ruleId?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: HitResult[];
    total: number;
    page: number;
    pageSize: number;
  }> => {
    const searchParams = new URLSearchParams();
    if (params.ruleId) searchParams.append('ruleId', params.ruleId);
    if (params.startTime) searchParams.append('startTime', params.startTime);
    if (params.endTime) searchParams.append('endTime', params.endTime);
    if (params.page !== undefined)
      searchParams.append('page', params.page.toString());
    if (params.pageSize !== undefined)
      searchParams.append('pageSize', params.pageSize.toString());

    return request<{
      items: HitResult[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/shadow/hit-analysis?${searchParams.toString()}`);
  },

  getAnomalies: (includeResolved = false): Promise<Anomaly[]> =>
    request<Anomaly[]>(`/anomalies?includeResolved=${includeResolved}`),

  resolveAnomaly: (
    id: string,
    resolution: string
  ): Promise<Anomaly> =>
    request<Anomaly>(`/anomalies/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolution } as ResolveAnomalyRequest),
    }),

  getReports: (): Promise<DrillReport[]> =>
    request<DrillReport[]>('/reports'),

  getReport: (id: string): Promise<DrillReport> =>
    request<DrillReport>(`/reports/${id}`),

  exportReport: (
    id: string,
    format: 'csv' | 'json'
  ): Promise<string> =>
    request<string>(`/reports/${id}/export?format=${format}`),

  getModifications: (params?: {
    entityType?: EntityType;
    entityId?: string;
  }): Promise<ModificationLog[]> => {
    const searchParams = new URLSearchParams();
    if (params?.entityType)
      searchParams.append('entityType', params.entityType);
    if (params?.entityId)
      searchParams.append('entityId', params.entityId);

    const query = searchParams.toString();
    return request<ModificationLog[]>(
      `/modifications${query ? `?${query}` : ''}`
    );
  },

  getDashboardStats: (): Promise<DashboardStats> =>
    request<DashboardStats>('/dashboard/stats'),
};
