import { create } from "zustand";
import type {
  MaterialItem,
  DrawingPoint,
  Anomaly,
  SupplementNote,
  ReviewAction,
  AnomalyStatus,
  MaterialStatus,
} from "@/types";
import {
  initialMaterials,
  initialDrawingPoints,
  initialAnomalies,
  initialSupplementNotes,
  initialReviewActions,
} from "@/data/mockData";

const STORAGE_KEY = "roof-drain-review-state-v1";

interface ReviewState {
  materials: MaterialItem[];
  drawingPoints: DrawingPoint[];
  anomalies: Anomaly[];
  supplementNotes: SupplementNote[];
  reviewActions: ReviewAction[];
  highlightedPointId: string | null;
  selectedAnomalyId: string | null;
  currentOperator: string;
  setHighlightedPoint: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setCurrentOperator: (op: string) => void;
  confirmAnomalyNormal: (anomalyId: string) => void;
  confirmAnomalyAbnormal: (anomalyId: string) => void;
  updateMaterialStatus: (
    materialId: string,
    status: MaterialStatus,
  ) => void;
  addSupplementNote: (
    materialId: string,
    content: string,
    author: string,
  ) => void;
  addMaterialItem: (
    item: Omit<MaterialItem, "id" | "createdAt">,
  ) => void;
  addReviewAction: (
    action: Omit<ReviewAction, "id" | "timestamp">,
  ) => void;
  resetAll: () => void;
}

function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function genId(prefix: string, n: number): string {
  return `${prefix}-${Date.now().toString().slice(-4)}-${n}`;
}

function loadFromStorage(): Partial<ReviewState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as Partial<ReviewState>;
  } catch {
    return null;
  }
}

function persist(state: ReviewState) {
  try {
    const { materials, drawingPoints, anomalies, supplementNotes, reviewActions } =
      state;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        materials,
        drawingPoints,
        anomalies,
        supplementNotes,
        reviewActions,
      }),
    );
  } catch {
    // ignore
  }
}

const saved = loadFromStorage();

export const useReviewStore = create<ReviewState>((set, get) => ({
  materials: saved?.materials ?? initialMaterials,
  drawingPoints: saved?.drawingPoints ?? initialDrawingPoints,
  anomalies: saved?.anomalies ?? initialAnomalies,
  supplementNotes: saved?.supplementNotes ?? initialSupplementNotes,
  reviewActions: saved?.reviewActions ?? initialReviewActions,
  highlightedPointId: null,
  selectedAnomalyId: null,
  currentOperator: "老叶",

  setHighlightedPoint: (id) => set({ highlightedPointId: id }),
  setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),
  setCurrentOperator: (op) => set({ currentOperator: op }),

  confirmAnomalyNormal: (anomalyId) => {
    const state = get();
    const target = state.anomalies.find((a) => a.id === anomalyId);
    if (!target) return;
    const before = { status: target.status };
    const after: AnomalyStatus = "已确认正常";
    const newAnomalies = state.anomalies.map((a) =>
      a.id === anomalyId
        ? {
            ...a,
            status: after,
            confirmedBy: state.currentOperator,
            confirmedAt: nowStr(),
          }
        : a,
    );
    // 联动材料行：若无其他异常则置为已复核
    const relatedMaterialId = target.materialItemId;
    const otherAnomalies = newAnomalies.filter(
      (a) =>
        a.materialItemId === relatedMaterialId &&
        a.status !== "已确认正常" &&
        a.id !== anomalyId,
    );
    let newMaterials = state.materials;
    if (otherAnomalies.length === 0) {
      const mat = state.materials.find((m) => m.id === relatedMaterialId);
      if (mat && mat.status !== "已复核") {
        newMaterials = state.materials.map((m) =>
          m.id === relatedMaterialId ? { ...m, status: "已复核" as MaterialStatus } : m,
        );
      }
    }
    const action: ReviewAction = {
      id: genId("RA", state.reviewActions.length + 1),
      type: "确认正常",
      targetType: "异常点",
      targetId: anomalyId,
      before,
      after: { status: after },
      operator: state.currentOperator,
      timestamp: nowStr(),
    };
    const next = {
      anomalies: newAnomalies,
      materials: newMaterials,
      reviewActions: [...state.reviewActions, action],
      selectedAnomalyId: null,
    };
    set(next);
    persist({ ...state, ...next });
  },

  confirmAnomalyAbnormal: (anomalyId) => {
    const state = get();
    const target = state.anomalies.find((a) => a.id === anomalyId);
    if (!target) return;
    const before = { status: target.status };
    const after: AnomalyStatus = "已确认异常";
    const newAnomalies = state.anomalies.map((a) =>
      a.id === anomalyId
        ? {
            ...a,
            status: after,
            confirmedBy: state.currentOperator,
            confirmedAt: nowStr(),
          }
        : a,
    );
    // 联动材料行状态
    const relatedMaterialId = target.materialItemId;
    const newMaterials = state.materials.map((m) =>
      m.id === relatedMaterialId ? { ...m, status: "异常" as MaterialStatus } : m,
    );
    const action: ReviewAction = {
      id: genId("RA", state.reviewActions.length + 1),
      type: "标记异常",
      targetType: "异常点",
      targetId: anomalyId,
      before,
      after: { status: after },
      operator: state.currentOperator,
      timestamp: nowStr(),
    };
    const next = {
      anomalies: newAnomalies,
      materials: newMaterials,
      reviewActions: [...state.reviewActions, action],
      selectedAnomalyId: null,
    };
    set(next);
    persist({ ...state, ...next });
  },

  updateMaterialStatus: (materialId, status) => {
    const state = get();
    const mat = state.materials.find((m) => m.id === materialId);
    if (!mat) return;
    const before = { status: mat.status };
    const newMaterials = state.materials.map((m) =>
      m.id === materialId ? { ...m, status } : m,
    );
    const action: ReviewAction = {
      id: genId("RA", state.reviewActions.length + 1),
      type: "状态修改",
      targetType: "材料行",
      targetId: materialId,
      before,
      after: { status },
      operator: state.currentOperator,
      timestamp: nowStr(),
    };
    const next = {
      materials: newMaterials,
      reviewActions: [...state.reviewActions, action],
    };
    set(next);
    persist({ ...state, ...next });
  },

  addSupplementNote: (materialId, content, author) => {
    const state = get();
    const note: SupplementNote = {
      id: genId("SN", state.supplementNotes.length + 1),
      materialItemId: materialId,
      content,
      author,
      createdAt: nowStr(),
    };
    const action: ReviewAction = {
      id: genId("RA", state.reviewActions.length + 1),
      type: "补录备注",
      targetType: "材料行",
      targetId: materialId,
      before: {},
      after: { supplement: content.slice(0, 40) + (content.length > 40 ? "…" : "") },
      operator: state.currentOperator,
      timestamp: nowStr(),
    };
    const next = {
      supplementNotes: [...state.supplementNotes, note],
      reviewActions: [...state.reviewActions, action],
    };
    set(next);
    persist({ ...state, ...next });
  },

  addMaterialItem: (item) => {
    const state = get();
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const newItem: MaterialItem = {
      ...item,
      id: item.code || genId("MT", state.materials.length + 1),
      createdAt: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    };
    const action: ReviewAction = {
      id: genId("RA", state.reviewActions.length + 1),
      type: "补录备注",
      targetType: "材料行",
      targetId: newItem.id,
      before: {},
      after: { name: newItem.name, code: newItem.code },
      operator: state.currentOperator,
      timestamp: nowStr(),
    };
    const next = {
      materials: [...state.materials, newItem],
      reviewActions: [...state.reviewActions, action],
    };
    set(next);
    persist({ ...state, ...next });
  },

  addReviewAction: (actionNoMeta) => {
    const state = get();
    const action: ReviewAction = {
      ...actionNoMeta,
      id: genId("RA", state.reviewActions.length + 1),
      timestamp: nowStr(),
    };
    const next = { reviewActions: [...state.reviewActions, action] };
    set(next);
    persist({ ...state, ...next });
  },

  resetAll: () => {
    const fresh = {
      materials: initialMaterials,
      drawingPoints: initialDrawingPoints,
      anomalies: initialAnomalies,
      supplementNotes: initialSupplementNotes,
      reviewActions: initialReviewActions,
    };
    localStorage.removeItem(STORAGE_KEY);
    set({
      ...fresh,
      highlightedPointId: null,
      selectedAnomalyId: null,
    });
  },
}));
