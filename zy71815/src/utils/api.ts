export interface SettlementRecord {
  id: string;
  store_name: string;
  activity_name: string;
  settlement_period: string;
  serial_number: string;
  amount: number;
  handling_fee: number;
  handling_fee_period: string;
  status: "pending" | "confirmed" | "withdrawn" | "conflict";
  created_at: string;
  updated_at: string;
}

export interface SettlementFilter {
  store_name?: string;
  activity_name?: string;
  settlement_period_start?: string;
  settlement_period_end?: string;
  status?: SettlementRecord["status"];
  amount_min?: number;
  amount_max?: number;
  page: number;
  page_size: number;
}

export interface SettlementListResponse {
  records: SettlementRecord[];
  total: number;
  page: number;
  page_size: number;
  filter_summary: string;
}

export interface ImportResult {
  session_id: string;
  total: number;
  new_count: number;
  duplicate_count: number;
  conflict_count: number;
  new_records: SettlementRecord[];
  duplicate_records: { record: SettlementRecord; reason: string }[];
  conflict_records: {
    existing: SettlementRecord;
    incoming: SettlementRecord;
    diff_fields: string[];
  }[];
}

export interface ImportSession {
  id: string;
  file_name: string;
  total_rows: number;
  new_count: number;
  duplicate_count: number;
  conflict_count: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export interface OperationLog {
  id: string;
  record_id: string;
  operation_type: "import" | "confirm" | "withdraw" | "modify";
  operator: string;
  before_value: string | null;
  after_value: string | null;
  reason: string | null;
  created_at: string;
}

export interface BatchResult {
  batch_id: string;
  total: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  details: {
    record_id: string;
    status: "success" | "skipped" | "failed";
    message: string;
  }[];
}

export interface ExportRequest {
  filter: SettlementFilter;
  include_reconciliation_note: boolean;
  export_scope: "filtered" | "selected";
  selected_ids?: string[];
}

export interface DashboardStats {
  pending_amount: number;
  pending_count: number;
  cross_period_fee: number;
  cross_period_count: number;
  confirmed_amount: number;
  confirmed_count: number;
  total_amount: number;
  total_count: number;
  recent_imports: ImportSession[];
}

const API_BASE = "/api";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "网络请求失败，请检查网络连接后重试" }));
    throw new Error(err.error || err.message || "操作失败，请稍后重试");
  }
  const json: ApiResponse<T> = await res.json();
  if (json.success && json.data !== undefined) {
    return json.data;
  }
  if (json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  settlements: {
    list(filter: SettlementFilter): Promise<SettlementListResponse> {
      const qs = buildQueryString(filter as unknown as Record<string, unknown>);
      return request(`/settlements${qs}`);
    },
    getById(id: string): Promise<SettlementRecord> {
      return request(`/settlements/${id}`);
    },
    confirmById(id: string): Promise<{ id: string; status: string }> {
      return request(`/settlements/${id}/confirm`, {
        method: "PUT",
      });
    },
    withdrawById(id: string, reason: string): Promise<{ id: string; status: string }> {
      return request(`/settlements/${id}/withdraw`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
    },
  },

  imports: {
    upload(file: File): Promise<ImportResult> {
      const formData = new FormData();
      formData.append("file", file);
      return request("/imports/upload", {
        method: "POST",
        headers: {},
        body: formData,
      });
    },
    confirm(sessionId: string): Promise<{ session_id: string; imported_count: number }> {
      return request(`/imports/${sessionId}/confirm`, {
        method: "POST",
      });
    },
    listSessions(): Promise<ImportSession[]> {
      return request("/imports/sessions");
    },
  },

  batch: {
    execute(
      record_ids: string[],
      operation: "confirm" | "withdraw",
      reason?: string
    ): Promise<BatchResult> {
      return request("/batch", {
        method: "POST",
        body: JSON.stringify({ record_ids, operation, reason }),
      });
    },
  },

  history: {
    list(filters?: Record<string, string>): Promise<OperationLog[]> {
      const qs = filters ? buildQueryString(filters) : "";
      return request(`/history${qs}`);
    },
    getByRecordId(recordId: string): Promise<OperationLog[]> {
      return request(`/history/record/${recordId}`);
    },
  },

  exports: {
    generate(params: ExportRequest): Promise<Blob> {
      return fetch(`${API_BASE}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("导出失败，请稍后重试");
        }
        return res.blob();
      });
    },
  },

  stats: {
    getDashboard(): Promise<DashboardStats> {
      return request("/settlements/stats");
    },
  },
};
