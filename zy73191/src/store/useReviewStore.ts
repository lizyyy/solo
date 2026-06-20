import { create } from "zustand";
import { persist } from "zustand/middleware";
import { contentHash } from "@/lib/hash";
import { buildReviewPair } from "@/lib/review";
import {
  boundarySafetyFactKey,
  seedAudit,
  seedJudgments,
  seedMaterials,
} from "@/lib/demo";
import type {
  AuditEntry,
  IngestResult,
  Judgment,
  Material,
  MaterialContribution,
  MaterialType,
  ReviewPair,
} from "@/lib/types";

const seedReview = buildReviewPair(seedMaterials, 6);

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
  hydrated: boolean;
  reseedDemo: () => void;
  ingestMaterial: (input: IngestInput) => IngestResult;
  submitDuplicateNote: () => IngestResult;
  runReview: (primary: "old" | "fixed") => void;
  setPrimary: (primary: "old" | "fixed") => void;
  recordJudgment: (input: JudgmentInput) => void;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      materials: seedMaterials,
      review: seedReview,
      judgments: seedJudgments,
      audit: seedAudit,
      lastIngest: null,
      hydrated: false,

      reseedDemo: () => {
        const review = buildReviewPair(seedMaterials, 6);
        set({
          materials: seedMaterials,
          review,
          judgments: seedJudgments,
          audit: seedAudit,
          lastIngest: null,
        });
      },

      ingestMaterial: (input) => {
        const hash = contentHash(input.type, input.version, input.content);
        const existing = get().materials.find((m) => m.contentHash === hash);
        if (existing) {
          const res: IngestResult = {
            duplicated: true,
            refId: existing.id,
            submittedId: existing.id,
          };
          set({ lastIngest: res });
          return res;
        }
        const id = makeId("m");
        const material: Material = {
          id,
          type: input.type,
          version: input.version,
          source: input.source,
          content: input.content,
          contentHash: hash,
          contributes: input.contributes,
          quote: input.quote ?? input.content.slice(0, 24),
        };
        set((state) => ({
          materials: [...state.materials, material],
          lastIngest: {
            duplicated: false,
            refId: id,
            submittedId: id,
          },
        }));
        return { duplicated: false, refId: id, submittedId: id };
      },

      submitDuplicateNote: () => {
        const note = get().materials.find((m) => m.type === "后补备注");
        if (!note) {
          return { duplicated: false, refId: "", submittedId: "" };
        }
        return get().ingestMaterial({
          type: note.type,
          version: note.version,
          source: note.source,
          content: note.content,
          quote: note.quote,
          contributes: note.contributes,
        });
      },

      runReview: (primary) => {
        const pair = buildReviewPair(get().materials, 6);
        if (pair) {
          pair.primary = primary;
          set({ review: pair });
        }
      },

      setPrimary: (primary) => {
        const review = get().review;
        if (review) set({ review: { ...review, primary } });
      },

      recordJudgment: ({ factKey, nextValue, reason, actor }) => {
        const prev =
          get().judgments.find((j) => j.factKey === factKey)?.value ?? "—（未复核）";
        const entry: AuditEntry = {
          id: makeId("a"),
          factKey,
          prevValue: prev,
          nextValue,
          reason,
          actor,
          ts: Date.now(),
        };
        set((state) => ({
          audit: [entry, ...state.audit],
          judgments: [
            ...state.judgments.filter((j) => j.factKey !== factKey),
            { factKey, value: nextValue, ts: Date.now() },
          ],
        }));
      },
    }),
    {
      name: "seq-boundary-review-v1",
      version: 1,
      partialize: (state) => ({
        materials: state.materials,
        review: state.review,
        judgments: state.judgments,
        audit: state.audit,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export { boundarySafetyFactKey };
