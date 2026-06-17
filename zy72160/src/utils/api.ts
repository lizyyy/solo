import type {
  Batch,
  BatchSummary,
  ImportJob,
  MergedPoint,
  ConflictItem,
  Anomaly,
  AuditLog,
  ExportRequest,
} from "../../shared/types";

const BASE = "/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg);
  }
  const json = await res.json();
  if (json.success && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  batches: {
    list: () => request<Batch[]>("/batches"),
    create: (name: string) =>
      request<Batch>("/batches", { method: "POST", body: JSON.stringify({ name }) }),
    summary: (id: string) => request<BatchSummary>(`/batches/${id}`),
  },

  imports: {
    upload: (batchId: string, file: File, sourceType: string) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sourceType", sourceType);
      return fetch(`${BASE}/batches/${batchId}/import`, { method: "POST", body: fd }).then(
        async (res) => {
          if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
          const json = await res.json();
          const data = json.data ?? json;
          return data as ImportJob;
        }
      );
    },
    list: (batchId: string) => request<ImportJob[]>(`/batches/${batchId}/imports`),
    preview: (importId: string) =>
      request<{ preview: Record<string, unknown>[]; fieldMapping: Record<string, string>; recordCount: number }>(`/batches/${importId}/preview`),
    updateMapping: (importId: string, mapping: Record<string, string>) =>
      request<ImportJob>(`/batches/${importId}/mapping`, {
        method: "PUT",
        body: JSON.stringify({ fieldMapping: mapping }),
      }),
    confirm: (importId: string) =>
      request<ImportJob>(`/batches/${importId}/confirm`, { method: "POST" }),
  },

  merge: {
    trigger: (batchId: string) =>
      request<{ newCount: number; matchedCount: number; conflictCount: number; anomalyCount: number }>(`/batches/${batchId}/merge`, { method: "POST" }),
    listPoints: (batchId: string) =>
      request<MergedPoint[]>(`/batches/${batchId}/merged-points`),
    getPoint: (pointId: string) => request<MergedPoint>(`/batches/points/${pointId}`),
    appendNote: (pointId: string, content: string, author?: string) =>
      request<{ id: string; mergedPointId: string; content: string; author: string; createdAt: string }>(
        `/batches/points/${pointId}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ content, author: author || "system" }),
        }
      ),
  },

  conflicts: {
    list: (batchId: string) =>
      request<ConflictItem[]>(`/conflicts/${batchId}/conflicts`),
    get: (conflictId: string) => request<ConflictItem>(`/conflicts/detail/${conflictId}`),
    resolve: (
      conflictId: string,
      data: {
        resolution: "use_gis" | "use_import" | "manual" | "pending_verification";
        resolutionReason: string;
        resolvedBy?: string;
        manualValue?: string;
      }
    ) =>
      request<{ id: string; resolution: string; resolved: boolean }>(`/conflicts/${conflictId}/resolve`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  anomalies: {
    list: (batchId: string) => request<Anomaly[]>(`/batches/${batchId}/anomalies`),
  },

  exports: {
    download: (batchId: string, req: ExportRequest) =>
      fetch(`${BASE}/batches/${batchId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        return res.blob();
      }),
  },

  auditLogs: {
    list: (batchId: string) =>
      request<AuditLog[]>(`/batches/${batchId}/audit-logs`),
  },
};
