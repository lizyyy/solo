import type {
  DraftEntry,
  ParamVersion,
  CalculationRun,
  Anomaly,
} from "@/types";

export interface FullRunResponse {
  run: CalculationRun;
  drafts: DraftEntry[];
  paramVersions: ParamVersion[];
  globalSummary: string;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listParamVersions: () =>
    request<ParamVersion[]>("/api/param-versions"),

  createParamVersion: (body: Omit<ParamVersion, "id" | "createdAt">) =>
    request<ParamVersion>("/api/param-versions", {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        tolerance: body.tolerance,
        roundingRule: body.roundingRule,
        sigFigs: body.sigFigs,
        isActive: body.isActive,
      }),
    }),

  activateParamVersion: (id: string) =>
    request<{ ok: boolean }>(`/api/param-versions/${id}/activate`, {
      method: "PATCH",
    }),

  submitBatch: (body: {
    drafts: {
      questionNo: string;
      answerContent: string;
      answerVersion?: string;
      supplementaryNote?: string;
      rawSource?: string;
    }[];
    paramVersionId?: string;
    paramVersion?: Omit<ParamVersion, "id" | "createdAt">;
    editorNote?: string;
    batchId?: string;
  }) =>
    request<FullRunResponse>("/api/batches/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listRuns: () => request<CalculationRun[]>("/api/runs"),

  getRun: (id: string) => request<FullRunResponse>(`/api/runs/${id}`),

  rerun: (id: string) =>
    request<FullRunResponse>(`/api/runs/${id}/rerun`, { method: "POST" }),

  setEditorNote: (id: string, editorNote: string) =>
    request<{ ok: boolean; editorNote: string }>(
      `/api/runs/${id}/editor-note`,
      {
        method: "PATCH",
        body: JSON.stringify({ editorNote }),
      }
    ),

  resolveAnomaly: (
    id: string,
    resolved: boolean,
    resolverNote?: string
  ) =>
    request<Anomaly>(`/api/anomalies/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolved, resolverNote }),
    }),

  updateDraftNote: (draftId: string, note: string) =>
    request<DraftEntry>(`/api/drafts/${draftId}/note`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),

  exportRun: (id: string) =>
    request<{ markdown: string }>(`/api/runs/${id}/export`),
};
