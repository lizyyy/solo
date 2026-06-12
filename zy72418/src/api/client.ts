import type {
  AudioRecord,
  ConflictRecord,
  AuditLog,
  SelfCheckReport,
  ImportPreviewResult,
  ResolveConflictRequest,
  UpdateRecordRequest,
  ReviewSubstituteRequest,
  AuthorizationPage,
} from "@shared/types";

const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  health: () => request<{ success: boolean; message: string }>("/health"),

  import: {
    preview: (csvContent: string, fileName: string) =>
      request<{ success: boolean; data: ImportPreviewResult }>("/import/preview", {
        method: "POST",
        body: JSON.stringify({ csvContent, fileName }),
      }),
    confirm: (preview: ImportPreviewResult, importedBy: string = "阿梅") =>
      request<{ success: boolean; data: { records: AudioRecord[]; count: number } }>(
        "/import/confirm",
        {
          method: "POST",
          body: JSON.stringify({ preview, importedBy }),
        }
      ),
    sampleCSV: () => fetch(`${API_BASE}/import/sample-csv`),
  },

  conflicts: {
    list: (includeResolved = false) =>
      request<{ success: boolean; data: (ConflictRecord & { record?: AudioRecord })[] }>(
        `/conflicts?includeResolved=${includeResolved}`
      ),
    detectAll: () =>
      request<{ success: boolean; data: { detectedCount: number; conflicts: ConflictRecord[] } }>(
        "/conflicts/detect-all",
        { method: "POST" }
      ),
    resolve: (id: string, body: ResolveConflictRequest) =>
      request<{ success: boolean; data: ConflictRecord }>(`/conflicts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  records: {
    list: (status?: string) =>
      request<{ success: boolean; data: AudioRecord[]; dataHash: string }>(
        status ? `/records?status=${status}` : "/records"
      ),
    get: (id: string) =>
      request<{ success: boolean; data: AudioRecord }>(`/records/${id}`),
    update: (id: string, body: UpdateRecordRequest) =>
      request<{ success: boolean; data: AudioRecord }>(`/records/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    export: () => fetch(`${API_BASE}/records/export`),
    temporarySubstitutes: () =>
      request<{ success: boolean; data: AudioRecord[] }>("/records/temporary-substitutes"),
    unreviewedSubstitutes: () =>
      request<{ success: boolean; data: AudioRecord[]; count: number }>(
        "/records/unreviewed-substitutes"
      ),
    reviewSubstitute: (body: ReviewSubstituteRequest) =>
      request<{ success: boolean; data: AudioRecord }>("/records/review-substitute", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  audit: {
    list: (recordId?: string) =>
      request<{ success: boolean; data: AuditLog[] }>(
        recordId ? `/audit/${recordId}` : "/audit"
      ),
  },

  selfCheck: {
    run: () => request<{ success: boolean; data: SelfCheckReport }>("/self-check/run"),
    get: () => request<{ success: boolean; data: SelfCheckReport }>("/self-check"),
  },

  authorization: {
    list: () => request<{ success: boolean; data: AuthorizationPage[] }>("/authorization"),
    get: (recordId: string) =>
      request<{ success: boolean; data: AuthorizationPage }>(`/authorization/${recordId}`),
  },
};
