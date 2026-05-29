import type {
  Artwork,
  Restoration,
  RestorationStep,
  MaterialBatch,
  Photo,
  Anomaly,
  Correction,
  Signature,
  TraceChainItem,
} from "../../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(url, {
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.error || error.message || `API Error: ${res.status}`);
  }
  const json = await res.json();
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  artworks: {
    list: (params?: { status?: string; keyword?: string }) => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.keyword) search.set("keyword", params.keyword);
      const qs = search.toString();
      return request<Artwork[]>(`/api/artworks${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<Artwork>(`/api/artworks/${id}`),
    create: (data: Partial<Artwork>) =>
      request<Artwork>("/api/artworks", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Artwork>) =>
      request<Artwork>(`/api/artworks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  restorations: {
    list: () => request<Restoration[]>("/api/restorations"),
    get: (id: string) => request<Restoration>(`/api/restorations/${id}`),
    create: (data: Partial<Restoration>) =>
      request<Restoration>("/api/restorations", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Restoration>) =>
      request<Restoration>(`/api/restorations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  steps: {
    list: (restorationId: string) =>
      request<RestorationStep[]>(`/api/restorations/${restorationId}/steps`),
    create: (restorationId: string, data: Partial<RestorationStep>) =>
      request<RestorationStep>(`/api/restorations/${restorationId}/steps`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (restorationId: string, stepId: string, data: Partial<RestorationStep>) =>
      request<RestorationStep>(`/api/restorations/${restorationId}/steps/${stepId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    reorder: (restorationId: string, stepIds: string[]) =>
      request<void>(`/api/restorations/${restorationId}/steps/reorder`, {
        method: "PUT",
        body: JSON.stringify(stepIds),
      }),
  },

  materials: {
    list: (restorationId: string) =>
      request<MaterialBatch[]>(`/api/restorations/${restorationId}/materials`),
    create: (restorationId: string, data: Partial<MaterialBatch>) =>
      request<MaterialBatch>(`/api/restorations/${restorationId}/materials`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<MaterialBatch>) =>
      request<MaterialBatch>(`/api/materials/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    usage: (id: string) =>
      request<RestorationStep[]>(`/api/materials/${id}/usage`),
  },

  photos: {
    list: (restorationId: string) =>
      request<Photo[]>(`/api/restorations/${restorationId}/photos`),
    upload: (restorationId: string, formData: FormData) =>
      request<Photo>(`/api/restorations/${restorationId}/photos`, {
        method: "POST",
        headers: {},
        body: formData,
      }),
    update: (id: string, data: Partial<Photo>) =>
      request<Photo>(`/api/photos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/photos/${id}`, { method: "DELETE" }),
  },

  anomalies: {
    list: (restorationId: string) =>
      request<Anomaly[]>(`/api/restorations/${restorationId}/anomalies`),
    check: (restorationId: string) =>
      request<Anomaly[]>(`/api/restorations/${restorationId}/anomalies/check`, {
        method: "POST",
      }),
    submitCorrection: (anomalyId: string, data: Partial<Correction>) =>
      request<Correction>(`/api/anomalies/${anomalyId}/corrections`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getCorrections: (anomalyId: string) =>
      request<Correction[]>(`/api/anomalies/${anomalyId}/corrections`),
  },

  signatures: {
    list: (restorationId: string) =>
      request<Signature[]>(`/api/restorations/${restorationId}/signatures`),
    submit: (restorationId: string, data: Partial<Signature>) =>
      request<Signature>(`/api/restorations/${restorationId}/signatures`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    traceChain: (restorationId: string) =>
      request<TraceChainItem[]>(`/api/restorations/${restorationId}/trace-chain`),
  },

  reports: {
    generate: (restorationId: string, options: {
      includeAnomalies: boolean;
      includeCorrections: boolean;
      includeSignatures: boolean;
      includeRules: boolean;
    }) =>
      request<{ id: string; fileUrl: string }>(`/api/restorations/${restorationId}/report`, {
        method: "POST",
        body: JSON.stringify(options),
      }),
    get: (id: string) => request<Blob>(`/api/reports/${id}`),
  },
};
