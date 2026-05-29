const base = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

export type CloudPlatform = 'aws' | 'aliyun' | 'tencent' | 'gcp';

export interface Script {
  id: number;
  name: string;
  file_type: string;
  content: string;
  cloud_platform: CloudPlatform;
  existing_policy_json: string;
  created_at: string;
  updated_at: string;
  risk_score?: number;
  api_call_count?: number;
}

export interface ApiCall {
  id: number;
  script_id: number;
  service: string;
  action: string;
  resource: string;
  source: 'static' | 'dynamic';
  line_number?: number;
  context?: string;
}

export interface Permission {
  id: number;
  script_id: number;
  service: string;
  action: string;
  type: 'existing' | 'derived';
  status: 'kept' | 'removed' | 'added' | 'modified';
  reason?: string;
}

export interface PermissionDiff {
  existing_permissions: Permission[];
  derived_permissions: Permission[];
  removed: Permission[];
  added: Permission[];
  kept: Permission[];
}

export type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Exception {
  id: number;
  script_id: number;
  permission_id?: number;
  reason: string;
  status: ExceptionStatus;
  expires_at?: string;
  impact_scope?: string;
  risk_note?: string;
  created_at: string;
}

export interface RiskDetail {
  id: string;
  type: 'dynamic_miss' | 'wildcard_over' | 'exception_long';
  script_id?: number;
  script_name?: string;
  reason: string;
  impact: string;
  next_action: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RiskScore {
  id: number;
  script_id: number;
  dynamic_miss_score: number;
  wildcard_score: number;
  exception_long_score: number;
  total_score: number;
  details: {
    dynamic_miss: { reason: string; impact: string; nextAction: string; context: string[] };
    wildcards: Array<{ permission: string; reason: string; impact: string; nextAction: string }>;
    long_running_exceptions: Array<{ id: number; reason: string; created_at: string; expires_at?: string }>;
  };
  calculated_at: string;
}

export interface Report {
  id: number;
  title: string;
  status: 'draft' | 'reviewed' | 'approved';
  created_at: string;
  item_count?: number;
}

export interface ReportItem {
  id: number;
  report_id: number;
  script_id: number;
  category: 'permission_change' | 'risk_item' | 'exception' | 'api_call';
  content: Record<string, unknown>;
  review_status: 'pending' | 'approved' | 'rejected';
  review_note?: string;
}

export interface DashboardStats {
  script_count: number;
  api_call_count: number;
  permission_count: number;
  high_risk_count: number;
  exception_pending_count: number;
  report_draft_count: number;
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  metadata_json?: string;
  created_at: string;
}

export const api = {
  scripts: {
    import: (data: { name?: string; content: string; file_type?: string; cloud_platform?: CloudPlatform; existing_policy?: Array<{ service: string; action: string }> }) =>
      req<Script>('/scripts/import', { method: 'POST', body: JSON.stringify(data) }),
    list: () => req<Script[]>('/scripts'),
    get: (id: number) => req<{ script: Script; api_calls: ApiCall[]; runtime_logs: Array<{ id: number; content: string; captured_at: string }>; permissions: Permission[]; risk_score?: RiskScore }>(`/scripts/${id}`),
    delete: (id: number) => req<void>(`/scripts/${id}`, { method: 'DELETE' }),
    parse: (id: number) => req<ApiCall[]>(`/scripts/${id}/parse`, { method: 'POST' }),
    addRuntimeLog: (id: number, content: string) => req<ApiCall[]>(`/scripts/${id}/runtime-log`, { method: 'POST', body: JSON.stringify({ content }) }),
    getPermissions: (id: number) => req<PermissionDiff>(`/scripts/${id}/permissions`),
    derivePermissions: (id: number) => req<PermissionDiff>(`/scripts/${id}/derive`, { method: 'POST' }),
    applyPolicy: (id: number) => req<void>(`/scripts/${id}/permissions`, { method: 'PUT' }),
    getRiskScore: (id: number) => req<RiskScore>(`/scripts/${id}/risk-score`),
  },
  exceptions: {
    list: (params?: { script_id?: number; status?: ExceptionStatus }) => {
      const q = new URLSearchParams();
      if (params?.script_id) q.set('script_id', String(params.script_id));
      if (params?.status) q.set('status', params.status);
      return req<Exception[]>(`/exceptions${q.size ? '?' + q : ''}`);
    },
    create: (data: Omit<Exception, 'id' | 'created_at' | 'status'>) =>
      req<Exception>('/exceptions', { method: 'POST', body: JSON.stringify({ ...data, status: 'pending' }) }),
    update: (id: number, data: Partial<Pick<Exception, 'status' | 'reason' | 'expires_at' | 'impact_scope' | 'risk_note'>>) =>
      req<void>(`/exceptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<void>(`/exceptions/${id}`, { method: 'DELETE' }),
    longRunning: () => req<Exception[]>('/exceptions/long-running'),
  },
  risks: {
    overview: () => req<{ total_score: number; breakdown: Array<{ category: string; score: number; count: number }> }>('/risks/overview'),
    dynamicMiss: () => req<RiskDetail[]>('/risks/dynamic-miss'),
    wildcardOver: () => req<RiskDetail[]>('/risks/wildcard-over'),
    exceptionLong: () => req<RiskDetail[]>('/risks/exception-long'),
  },
  reports: {
    list: () => req<Report[]>('/reports'),
    generate: (data: { script_ids?: number[]; title?: string }) =>
      req<{ report_id: number }>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => req<{ report: Report; items: ReportItem[] }>(`/reports/${id}`),
    export: (id: number, format: 'json' | 'csv' | 'md') =>
      fetch(`${base}/reports/${id}/export?format=${format}`).then(r => {
        const cd = r.headers.get('Content-Disposition');
        const fn = cd?.match(/filename="(.+)"/)?.[1] || `report.${format}`;
        return r.text().then(content => ({ content, filename: fn }));
      }),
    review: (id: number, data: { item_id?: number; review_status: string; review_note?: string }) =>
      req<void>(`/reports/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  dashboard: {
    stats: () => req<DashboardStats>('/dashboard/stats'),
    activities: (limit = 20) => req<Activity[]>(`/dashboard/activities?limit=${limit}`),
    permissionDistribution: () => req<Array<{ name: string; value: number }>>('/dashboard/permission-distribution'),
  },
  config: {
    get: () => req<Record<string, unknown>>('/config'),
    set: (key: string, value: Record<string, unknown>) =>
      req<void>('/config', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  },
};
