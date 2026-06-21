import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BoundarySample,
  CalcSpec,
  ExportSnapshot,
  Material,
  MatrixCell,
  NoteSourceType,
  PageSummary,
  ScoringNote,
  UnitMissingRecord,
} from "@/types";
import {
  BOUNDARY_SAMPLES,
  CALC_SPECS,
  CURRENT_CALC_SPEC_ID,
  MATERIALS,
  SCORING_NOTES,
  UNIT_MISSING_RECORDS,
  buildMatrix,
} from "@/data/sample";
import { computeSummary } from "@/utils/matrix";

const SCHEMA_VERSION = 2;

export interface FocusState {
  cellKey?: string;
  noteId?: string;
  calcSpecId?: string;
  boundarySampleId?: string;
}

interface ExplanationState {
  schemaVersion: number;
  cells: MatrixCell[];
  calcSpecs: CalcSpec[];
  notes: ScoringNote[];
  boundarySamples: BoundarySample[];
  unitMissing: UnitMissingRecord[];
  materials: Material[];
  exports: ExportSnapshot[];
  currentCalcSpecId: string;
  // 印证快照：上次"印证/保存"时的摘要，用于与实时摘要比对
  summarySnapshot: PageSummary | null;
  focus: FocusState;

  // actions
  addNote: (note: Omit<ScoringNote, "id" | "createdAt" | "version">) => void;
  updateNote: (id: string, patch: Partial<ScoringNote>) => void;
  toggleInfluence: (id: string) => void;
  removeNote: (id: string) => void;

  quarantineCell: (cellKey: string, userId: string, itemId: string, reason: string) => void;
  restoreUnitMissing: (id: string, restoreReason: string) => void;

  addMaterial: (m: Omit<Material, "id" | "createdAt">) => void;
  removeMaterial: (id: string) => void;

  setCurrentCalcSpec: (id: string) => void;

  reverify: () => void;
  exportSnapshot: () => ExportSnapshot;

  setFocus: (f: FocusState) => void;
  clearFocus: () => void;

  resetAll: () => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function freshSeed() {
  return {
    cells: buildMatrix(),
    calcSpecs: CALC_SPECS,
    notes: SCORING_NOTES,
    boundarySamples: BOUNDARY_SAMPLES,
    unitMissing: UNIT_MISSING_RECORDS,
    materials: MATERIALS,
    currentCalcSpecId: CURRENT_CALC_SPEC_ID,
  };
}

export const useExplanationStore = create<ExplanationState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      ...freshSeed(),
      exports: [],
      summarySnapshot: null,
      focus: {},

      addNote: (note) =>
        set((s) => ({
          notes: [
            ...s.notes,
            {
              ...note,
              id: uid("note"),
              createdAt: new Date().toISOString(),
              version: 1,
            },
          ],
        })),

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),

      toggleInfluence: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, influencesConclusion: !n.influencesConclusion } : n,
          ),
        })),

      removeNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      quarantineCell: (cellKey, userId, itemId, reason) =>
        set((s) => {
          const exists = s.unitMissing.some(
            (u) => u.cellKey === cellKey && !u.restored,
          );
          if (exists) return s;
          return {
            unitMissing: [
              ...s.unitMissing,
              {
                id: uid("um"),
                cellKey,
                userId,
                itemId,
                reason,
                quarantinedAt: new Date().toISOString(),
                restored: false,
              },
            ],
            cells: s.cells.map((c) =>
              c.userId === userId && c.itemId === itemId
                ? { ...c, hasUnit: false, anomaly: true }
                : c,
            ),
          };
        }),

      restoreUnitMissing: (id, restoreReason) =>
        set((s) => ({
          unitMissing: s.unitMissing.map((u) =>
            u.id === id ? { ...u, restored: true, restoreReason } : u,
          ),
        })),

      addMaterial: (m) =>
        set((s) => ({
          materials: [
            ...s.materials,
            { ...m, id: uid("mat"), createdAt: new Date().toISOString() },
          ],
        })),

      removeMaterial: (id) =>
        set((s) => ({ materials: s.materials.filter((m) => m.id !== id) })),

      setCurrentCalcSpec: (id) => set({ currentCalcSpecId: id }),

      reverify: () => {
        const s = get();
        const live = computeSummary({
          cells: s.cells,
          notes: s.notes,
          unitMissing: s.unitMissing,
          calcSpecId: s.currentCalcSpecId,
        });
        set({ summarySnapshot: live });
      },

      exportSnapshot: () => {
        const s = get();
        const live = computeSummary({
          cells: s.cells,
          notes: s.notes,
          unitMissing: s.unitMissing,
          calcSpecId: s.currentCalcSpecId,
        });
        const calcSpec = s.calcSpecs.find((c) => c.id === s.currentCalcSpecId);
        const snapshot: ExportSnapshot = {
          id: uid("exp"),
          createdAt: new Date().toISOString(),
          summary: live,
          calcSpecId: s.currentCalcSpecId,
          calcSpecName: calcSpec?.name ?? s.currentCalcSpecId,
          noteCount: s.notes.length,
        };
        set((st) => ({
          exports: [snapshot, ...st.exports].slice(0, 12),
          summarySnapshot: live,
        }));
        return snapshot;
      },

      setFocus: (f) => set({ focus: f }),
      clearFocus: () => set({ focus: {} }),

      resetAll: () =>
        set({
          ...freshSeed(),
          exports: [],
          summarySnapshot: null,
          focus: {},
        }),
    }),
    {
      name: "mf-atlas-explanation-v1",
      version: SCHEMA_VERSION,
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        cells: s.cells,
        calcSpecs: s.calcSpecs,
        notes: s.notes,
        boundarySamples: s.boundarySamples,
        unitMissing: s.unitMissing,
        materials: s.materials,
        exports: s.exports,
        currentCalcSpecId: s.currentCalcSpecId,
        summarySnapshot: s.summarySnapshot,
      }),
    },
  ),
);

// 选择器：实时摘要（始终从持久态重算，用 useMemo 保证引用稳定，避免无限渲染）
export function useLiveSummary(): PageSummary {
  const cells = useExplanationStore((s) => s.cells);
  const notes = useExplanationStore((s) => s.notes);
  const unitMissing = useExplanationStore((s) => s.unitMissing);
  const currentCalcSpecId = useExplanationStore((s) => s.currentCalcSpecId);
  return useMemo(
    () => computeSummary({ cells, notes, unitMissing, calcSpecId: currentCalcSpecId }),
    [cells, notes, unitMissing, currentCalcSpecId],
  );
}

export type { NoteSourceType };
