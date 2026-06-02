import { create } from "zustand";
import type {
  Point,
  Feedback,
  PlanVersion,
  JudgmentLog,
  AliasName,
  MergeSuggestion,
  PointStatus,
} from "@/types";
import {
  SEED_POINTS,
  SEED_FEEDBACKS,
  SEED_PLANS,
  SEED_JUDGMENTS,
  SEED_ALIASES,
  SEED_MERGES,
} from "@/data/seed";
import { findMergeSuggestions, computeSimilarity } from "@/utils/merge";

interface AppState {
  points: Point[];
  feedbacks: Feedback[];
  plans: PlanVersion[];
  judgments: JudgmentLog[];
  aliases: AliasName[];
  merges: MergeSuggestion[];

  addPoint: (point: Point) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  changePointStatus: (id: string, toStatus: PointStatus, reason: string, operator: string) => void;
  deletePoint: (id: string) => void;

  addFeedback: (feedback: Feedback) => void;
  updateFeedback: (id: string, updates: Partial<Feedback>) => void;

  addPlan: (plan: PlanVersion) => void;
  updatePlan: (id: string, updates: Partial<PlanVersion>) => void;

  addAlias: (alias: AliasName) => void;

  resolveMerge: (id: string, confirmed: boolean, resolvedBy: string) => void;
  addMergeSuggestion: (suggestion: MergeSuggestion) => void;

  importFeedbackAndMatch: (feedback: Feedback, pointName: string) => void;

  resetToSeed: () => void;
}

const STORAGE_KEY = "slow_walk_safety_data";

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToStorage(state: AppState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        points: state.points,
        feedbacks: state.feedbacks,
        plans: state.plans,
        judgments: state.judgments,
        aliases: state.aliases,
        merges: state.merges,
      })
    );
  } catch {}
}

const seedState = {
  points: SEED_POINTS,
  feedbacks: SEED_FEEDBACKS,
  plans: SEED_PLANS,
  judgments: SEED_JUDGMENTS,
  aliases: SEED_ALIASES,
  merges: SEED_MERGES,
};

function getInitialState() {
  const stored = loadFromStorage();
  if (stored && stored.points && stored.points.length > 0) {
    return {
      points: stored.points,
      feedbacks: stored.feedbacks || [],
      plans: stored.plans || [],
      judgments: stored.judgments || [],
      aliases: stored.aliases || [],
      merges: stored.merges || [],
    };
  }
  return seedState;
}

export const useStore = create<AppState>((set, get) => ({
  ...getInitialState(),

  addPoint: (point) => {
    set((s) => {
      const newPoints = [...s.points, point];
      const newMerges = findMergeSuggestions(point, s.points);
      const state = {
        ...s,
        points: newPoints,
        merges: [...s.merges, ...newMerges],
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  updatePoint: (id, updates) => {
    set((s) => {
      const state = {
        ...s,
        points: s.points.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  changePointStatus: (id, toStatus, reason, operator) => {
    set((s) => {
      const point = s.points.find((p) => p.id === id);
      if (!point) return s;
      const log: JudgmentLog = {
        id: `jl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        pointId: id,
        fromStatus: point.status,
        toStatus,
        reason,
        operator,
        createdAt: new Date().toISOString(),
      };
      const state = {
        ...s,
        points: s.points.map((p) =>
          p.id === id
            ? { ...p, status: toStatus, updatedAt: new Date().toISOString() }
            : p
        ),
        judgments: [...s.judgments, log],
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  deletePoint: (id) => {
    set((s) => {
      const state = {
        ...s,
        points: s.points.filter((p) => p.id !== id),
        feedbacks: s.feedbacks.filter((f) => f.pointId !== id),
        plans: s.plans.filter((p) => p.pointId !== id),
        judgments: s.judgments.filter((j) => j.pointId !== id),
        aliases: s.aliases.filter((a) => a.pointId !== id),
        merges: s.merges.filter(
          (m) => m.sourcePointId !== id && m.targetPointId !== id
        ),
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  addFeedback: (feedback) => {
    set((s) => {
      const state = { ...s, feedbacks: [...s.feedbacks, feedback] };
      saveToStorage(state as AppState);
      return state;
    });
  },

  updateFeedback: (id, updates) => {
    set((s) => {
      const state = {
        ...s,
        feedbacks: s.feedbacks.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  addPlan: (plan) => {
    set((s) => {
      const state = { ...s, plans: [...s.plans, plan] };
      saveToStorage(state as AppState);
      return state;
    });
  },

  updatePlan: (id, updates) => {
    set((s) => {
      const state = {
        ...s,
        plans: s.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  addAlias: (alias) => {
    set((s) => {
      const state = { ...s, aliases: [...s.aliases, alias] };
      saveToStorage(state as AppState);
      return state;
    });
  },

  resolveMerge: (id, confirmed, resolvedBy) => {
    set((s) => {
      const merge = s.merges.find((m) => m.id === id);
      if (!merge) return s;

      let newPoints = s.points;
      let newFeedbacks = s.feedbacks;
      let newAliases = s.aliases;
      let newMerges = s.merges.map((m) =>
        m.id === id
          ? {
              ...m,
              status: confirmed ? ("confirmed" as const) : ("rejected" as const),
              resolvedBy,
              resolvedAt: new Date().toISOString(),
            }
          : m
      );

      if (confirmed) {
        const sourceFeedbacks = s.feedbacks.filter(
          (f) => f.pointId === merge.sourcePointId
        );
        const sourceAliases = s.aliases.filter(
          (a) => a.pointId === merge.sourcePointId
        );

        newFeedbacks = s.feedbacks.map((f) =>
          f.pointId === merge.sourcePointId
            ? { ...f, pointId: merge.targetPointId }
            : f
        );

        const sourcePoint = s.points.find(
          (p) => p.id === merge.sourcePointId
        );
        if (sourcePoint) {
          newAliases = [
            ...s.aliases.map((a) =>
              a.pointId === merge.sourcePointId
                ? { ...a, pointId: merge.targetPointId }
                : a
            ),
            {
              id: `a-${Date.now()}`,
              pointId: merge.targetPointId,
              alias: sourcePoint.standardName,
              source: "归并合并",
              createdAt: new Date().toISOString(),
            },
          ];
        }

        newPoints = s.points.filter((p) => p.id !== merge.sourcePointId);

        newMerges = newMerges.filter(
          (m) =>
            m.id === id ||
            (m.sourcePointId !== merge.sourcePointId &&
              m.targetPointId !== merge.sourcePointId)
        );
      }

      const state = {
        ...s,
        points: newPoints,
        feedbacks: newFeedbacks,
        aliases: newAliases,
        merges: newMerges,
      };
      saveToStorage(state as AppState);
      return state;
    });
  },

  addMergeSuggestion: (suggestion) => {
    set((s) => {
      const state = { ...s, merges: [...s.merges, suggestion] };
      saveToStorage(state as AppState);
      return state;
    });
  },

  importFeedbackAndMatch: (feedback, pointName) => {
    const state = get();

    let bestMatch: Point | null = null;
    let bestSim = 0;

    for (const point of state.points) {
      const sim = computeSimilarity(pointName, point.standardName);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = point;
      }
    }

    if (bestMatch && bestSim >= 0.85) {
      const fb: Feedback = { ...feedback, pointId: bestMatch.id };
      get().addFeedback(fb);

      if (!state.aliases.some((a) => a.pointId === bestMatch!.id && a.alias === pointName)) {
        get().addAlias({
          id: `a-${Date.now()}`,
          pointId: bestMatch.id,
          alias: pointName,
          source: "反馈录入自动匹配",
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const newPoint: Point = {
        id: `p-${Date.now()}`,
        standardName: pointName,
        schoolName: "",
        status: "pending",
        latitude: null,
        longitude: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      get().addPoint(newPoint);
      const fb: Feedback = { ...feedback, pointId: newPoint.id };
      get().addFeedback(fb);
    }
  },

  resetToSeed: () => {
    set(seedState);
    localStorage.removeItem(STORAGE_KEY);
    saveToStorage({ ...seedState } as AppState);
  },
}));
