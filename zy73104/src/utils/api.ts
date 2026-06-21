import type {
  Checklist,
  ChecklistStatus,
  Role,
  CreateNoteReq,
  ReviewStats,
  LayerNameValidation,
} from "shared/types";

const API_BASE = "/api";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success || !json.data) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export const api = {
  getChecklists: (status?: ChecklistStatus) =>
    request<Checklist[]>(
      status ? `/checklists?status=${status}` : "/checklists"
    ),

  getChecklist: (id: string) =>
    request<Checklist>(`/checklists/${id}`),

  createChecklist: (data: Partial<Checklist>) =>
    request<Checklist>("/checklists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateChecklist: (id: string, data: Partial<Checklist>) =>
    request<Checklist>(`/checklists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  changeStatus: (id: string, toStatus: ChecklistStatus, reason: string, changedBy: Role) =>
    request<Checklist>(`/checklists/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ toStatus, reason, changedBy }),
    }),

  addNote: (id: string, note: CreateNoteReq) =>
    request<Checklist>(`/checklists/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(note),
    }),

  withdrawNote: (id: string, noteId: string, withdrawnBy: Role) =>
    request<Checklist>(`/checklists/${id}/notes/${noteId}/withdraw`, {
      method: "PATCH",
      body: JSON.stringify({ withdrawnBy }),
    }),

  getReviewStats: () =>
    request<ReviewStats>("/review/stats"),

  validateLayerName: (name: string) =>
    request<LayerNameValidation>(`/validate/layername?name=${encodeURIComponent(name)}`),
};
