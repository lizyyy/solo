import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Anomaly, Snapshot, Note, RerunTracker, AnomalyStatus } from "@/types";
import { mockAnomalies, mockSnapshots, mockNotes } from "@/data/mockData";
import { makeSnapshot, makeNote, generateRunId, mergeRerunAnomalies } from "@/utils/snapshot";

interface AnomaliesState {
  anomalies: Anomaly[];
  snapshots: Snapshot[];
  notes: Note[];
  reruns: RerunTracker[];
  expandedId: string | null;
  filterSeverity: "all" | "critical" | "warning" | "info";
  filterStatus: "all" | AnomalyStatus;
  addAnomaly: (a: Omit<Anomaly, "id" | "createdAt" | "updatedAt" | "isRerunGenerated" | "runId">) => Anomaly;
  updateStatus: (id: string, status: AnomalyStatus, operator: string, note?: string) => void;
  updateConclusion: (id: string, conclusionAfter: string, operator: string, note?: string) => void;
  updateHoldDecision: (id: string, holdDecision: Anomaly["holdDecision"], holdReason: string, operator: string, note?: string) => void;
  addNote: (anomalyId: string, content: string, author: string) => Note;
  toggleExpand: (id: string | null) => void;
  setFilterSeverity: (s: AnomaliesState["filterSeverity"]) => void;
  setFilterStatus: (s: AnomaliesState["filterStatus"]) => void;
  runRecheck: (operator: string, simulatedNewAnomalies?: Anomaly[]) => RerunTracker;
  getSnapshotsFor: (anomalyId: string) => Snapshot[];
  getNotesFor: (anomalyId: string) => Note[];
  resetMock: () => void;
}

export const useAnomaliesStore = create<AnomaliesState>()(
  persist(
    (set, get) => ({
      anomalies: mockAnomalies,
      snapshots: mockSnapshots,
      notes: mockNotes,
      reruns: [],
      expandedId: null,
      filterSeverity: "all",
      filterStatus: "all",
      addAnomaly: (a) => {
        const now = new Date().toISOString();
        const runId = generateRunId();
        const newA: Anomaly = {
          ...a,
          id: `ANM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: now,
          updatedAt: now,
          isRerunGenerated: false,
          runId,
        };
        set({ anomalies: [...get().anomalies, newA] });
        return newA;
      },
      updateStatus: (id, status, operator, note) => {
        const existing = get().anomalies.find((a) => a.id === id);
        if (!existing || existing.status === status) return;
        const snap = makeSnapshot({
          anomalyId: id,
          fieldName: "status",
          oldValue: existing.status,
          newValue: status,
          operator,
          note,
        });
        set({
          anomalies: get().anomalies.map((a) =>
            a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
          ),
          snapshots: [...get().snapshots, snap],
        });
      },
      updateConclusion: (id, conclusionAfter, operator, note) => {
        const existing = get().anomalies.find((a) => a.id === id);
        if (!existing || existing.conclusionAfter === conclusionAfter) return;
        const snap = makeSnapshot({
          anomalyId: id,
          fieldName: "conclusion",
          oldValue: existing.conclusionAfter || "",
          newValue: conclusionAfter,
          operator,
          note,
        });
        set({
          anomalies: get().anomalies.map((a) =>
            a.id === id
              ? {
                  ...a,
                  conclusionBefore: a.conclusionAfter,
                  conclusionAfter,
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
          snapshots: [...get().snapshots, snap],
        });
      },
      updateHoldDecision: (id, holdDecision, holdReason, operator, note) => {
        const existing = get().anomalies.find((a) => a.id === id);
        if (!existing || existing.holdDecision === holdDecision) return;
        const snap = makeSnapshot({
          anomalyId: id,
          fieldName: "holdDecision",
          oldValue: existing.holdDecision || "",
          newValue: holdDecision || "",
          operator,
          note,
        });
        set({
          anomalies: get().anomalies.map((a) =>
            a.id === id
              ? { ...a, holdDecision, holdReason, updatedAt: new Date().toISOString() }
              : a
          ),
          snapshots: [...get().snapshots, snap],
        });
      },
      addNote: (anomalyId, content, author) => {
        const n = makeNote({ anomalyId, content, author, isProtected: true });
        set({ notes: [...get().notes, n] });
        return n;
      },
      toggleExpand: (id) => set({ expandedId: get().expandedId === id ? null : id }),
      setFilterSeverity: (s) => set({ filterSeverity: s }),
      setFilterStatus: (s) => set({ filterStatus: s }),
      runRecheck: (operator, simulated) => {
        const runId = generateRunId();
        const startedAt = new Date().toISOString();

        const simulatedNew: Anomaly[] =
          simulated ||
          get()
            .anomalies.filter((a) => a.status === "open" && Math.random() > 0.5)
            .map((a) => ({
              ...a,
              id: `ANM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              status: (["processing", "suspended", "resolved"] as AnomalyStatus[])[
                Math.floor(Math.random() * 3)
              ],
              conclusionAfter: "重跑后结论更新",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));

        const result = mergeRerunAnomalies({
          existingAnomalies: get().anomalies,
          newAnomalies: simulatedNew,
          existingNotes: get().notes,
          existingSnapshots: get().snapshots,
          runId,
          operator,
        });

        const tracker: RerunTracker = {
          runId,
          startedAt,
          finishedAt: new Date().toISOString(),
          status: "finished",
          anomaliesCountBefore: result.report.countBefore,
          anomaliesCountAfter: result.report.countAfter,
          preservedNoteIds: result.report.preservedNoteIds,
        };

        set({
          anomalies: result.mergedAnomalies,
          snapshots: result.mergedSnapshots,
          notes: result.mergedNotes,
          reruns: [tracker, ...get().reruns],
        });

        return tracker;
      },
      getSnapshotsFor: (id) =>
        get()
          .snapshots.filter((s) => s.anomalyId === id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      getNotesFor: (id) =>
        get()
          .notes.filter((n) => n.anomalyId === id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      resetMock: () =>
        set({
          anomalies: mockAnomalies,
          snapshots: mockSnapshots,
          notes: mockNotes,
          reruns: [],
          expandedId: null,
          filterSeverity: "all",
          filterStatus: "all",
        }),
    }),
    { name: "sgr-anomalies-store" }
  )
);
