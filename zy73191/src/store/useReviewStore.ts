import { create } from "zustand";
import type {
  AuditEntry,
  IngestResult,
  Judgment,
  Material,
  MaterialContribution,
  MaterialType,
  ReviewPair,
} from "@/lib/types";

export interface IngestInput {
  type: MaterialType;
  version: string;
  source: string;
  content: string;
  quote?: string;
  contributes?: MaterialContribution;
}

export interface JudgmentInput {
  factKey: string;
  nextValue: string;
  reason: string;
  actor: string;
}

interface ReviewState {
  materials: Material[];
  review: ReviewPair | null;
  judgments: Judgment[];
  audit: AuditEntry[];
  lastIngest: IngestResult | null;
  loading: boolean;
  error: string | null;
  fetchMaterials: () => Promise<void>;
  fetchReview: () => Promise<void>;
  fetchJudgment: () => Promise<void>;
  fetchAudit: () => Promise<void>;
  seedDemo: () => Promise<void>;
  ingestMaterial: (input: IngestInput) => Promise<IngestResult>;
  submitDuplicateNote: () => Promise<IngestResult>;
  runReview: (primary: "old" | "fixed") => Promise<void>;
  recordJudgment: (input: JudgmentInput) => Promise<void>;
  refreshAll: () => Promise<void>;
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const boundarySafetyFactKey = "boundary-safety";

export const useReviewStore = create<ReviewState>()((set, get) => ({
  materials: [],
  review: null,
  judgments: [],
  audit: [],
  lastIngest: null,
  loading: false,
  error: null,

  fetchMaterials: async () => {
    const materials = await api<Material[]>("GET", "/api/materials");
    set({ materials });
  },

  fetchReview: async () => {
    const review = await api<ReviewPair | null>("GET", "/api/review");
    set({ review });
  },

  fetchJudgment: async () => {
    const j = await api<{ value: string; factKey: string; ts: number | null }>(
      "GET",
      "/api/judgment",
    );
    set({
      judgments: j.ts ? [{ factKey: j.factKey, value: j.value, ts: j.ts }] : [],
    });
  },

  fetchAudit: async () => {
    const audit = await api<AuditEntry[]>("GET", "/api/audit");
    set({ audit });
  },

  seedDemo: async () => {
    set({ loading: true, error: null });
    try {
      await api("POST", "/api/seed");
      await get().refreshAll();
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },

  ingestMaterial: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await api<IngestResult & { material?: Material }>(
        "POST",
        "/api/materials",
        {
          type: input.type,
          version: input.version,
          source: input.source,
          content: input.content,
          quote: input.quote,
        },
      );
      set({ lastIngest: result });
      await get().fetchMaterials();
      return result;
    } catch (e) {
      set({ error: String(e) });
      return { duplicated: false, refId: "", submittedId: "" };
    } finally {
      set({ loading: false });
    }
  },

  submitDuplicateNote: async () => {
    const note = get().materials.find((m) => m.type === "后补备注");
    if (!note) return { duplicated: false, refId: "", submittedId: "" };
    return get().ingestMaterial({
      type: note.type,
      version: note.version,
      source: note.source,
      content: note.content,
      quote: note.quote,
      contributes: note.contributes,
    });
  },

  runReview: async (primary) => {
    set({ loading: true, error: null });
    try {
      const pair = await api<ReviewPair>("POST", "/api/review", { primary });
      set({ review: pair });
      await Promise.all([get().fetchJudgment(), get().fetchAudit()]);
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },

  recordJudgment: async ({ nextValue, reason, actor }) => {
    set({ loading: true, error: null });
    try {
      await api("POST", "/api/judgment", {
        value: nextValue,
        reason,
        actor,
      });
      await Promise.all([get().fetchJudgment(), get().fetchAudit()]);
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchMaterials(),
        get().fetchReview(),
        get().fetchJudgment(),
        get().fetchAudit(),
      ]);
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },
}));
