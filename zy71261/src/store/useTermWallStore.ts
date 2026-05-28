import { create } from "zustand";
import type {
  PositionRecord,
  AggregatedBlock,
  FilterState,
  ValidationResult,
  ExportRecord,
} from "@/types/index";
import { mockPositions } from "@/data/mockData";
import { validatePositions } from "@/utils/validation";
import {
  aggregatePositions,
  filterPositions,
  getVarietySummary,
  computeDataHash,
} from "@/utils/aggregate";
import {
  savePositions,
  loadPositions,
  saveExportRecord,
  loadExportRecords,
  saveValidationResult,
  loadLatestValidation,
  saveUIState,
  loadUIState,
  clearDatabase,
} from "@/utils/persistence";

interface TermWallState {
  positions: PositionRecord[];
  filteredPositions: PositionRecord[];
  aggregatedBlocks: AggregatedBlock[];
  filter: FilterState;
  validation: ValidationResult | null;
  exportRecords: ExportRecord[];
  selectedBlock: AggregatedBlock | null;
  hoveredBlock: AggregatedBlock | null;
  cameraPreset: string;
  dataLoaded: boolean;
  dataHash: string;
  lastProcessedAt: number | null;
  filterPanelOpen: boolean;
  dataPanelOpen: boolean;
  drillDownOpen: boolean;
  sliceViewOpen: boolean;
  sliceMonth: string | null;

  initializeData: () => Promise<void>;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  selectBlock: (block: AggregatedBlock | null) => void;
  hoverBlock: (block: AggregatedBlock | null) => void;
  setCameraPreset: (preset: string) => void;
  openDrillDown: (block: AggregatedBlock) => void;
  closeDrillDown: () => void;
  openSliceView: (month: string) => void;
  closeSliceView: () => void;
  toggleFilterPanel: () => void;
  toggleDataPanel: () => void;
  exportCSV: () => Promise<void>;
  exportPNG: () => Promise<void>;
}

const defaultFilter: FilterState = {
  varieties: [],
  months: [],
  directions: [],
  clientSearch: "",
};

function recompute(state: TermWallState): Partial<TermWallState> {
  const filtered = filterPositions(state.positions, state.filter);
  const aggregated = aggregatePositions(filtered);
  return { filteredPositions: filtered, aggregatedBlocks: aggregated };
}

export const useTermWallStore = create<TermWallState>((set, get) => ({
  positions: [],
  filteredPositions: [],
  aggregatedBlocks: [],
  filter: { ...defaultFilter },
  validation: null,
  exportRecords: [],
  selectedBlock: null,
  hoveredBlock: null,
  cameraPreset: "perspective",
  dataLoaded: false,
  dataHash: "",
  lastProcessedAt: null,
  filterPanelOpen: true,
  dataPanelOpen: true,
  drillDownOpen: false,
  sliceViewOpen: false,
  sliceMonth: null,

  initializeData: async () => {
    const hasClearedOldDB = localStorage.getItem("termwall_db_cleared_v2");
    if (!hasClearedOldDB) {
      await clearDatabase();
      localStorage.setItem("termwall_db_cleared_v2", "1");
    }

    let positions: PositionRecord[];
    let restored = false;

    try {
      const saved = await loadPositions();
      if (saved.length > 0) {
        positions = saved;
        restored = true;
      } else {
        positions = mockPositions;
      }
    } catch {
      await clearDatabase();
      positions = mockPositions;
    }

    const validation = validatePositions(positions);
    const dataHash = computeDataHash(positions);
    await savePositions(positions);
    await saveValidationResult(validation);

    let uiState = loadUIState();
    if (!uiState) {
      uiState = { filter: { ...defaultFilter }, cameraPreset: "perspective" };
    }

    let exportRecords: ExportRecord[] = [];
    try {
      exportRecords = await loadExportRecords();
    } catch {}

    let lastProcessedAt: number | null = null;
    try {
      const latestVal = await loadLatestValidation();
      if (latestVal) {
        lastProcessedAt = latestVal.timestamp;
        if (latestVal.dataHash !== dataHash) {
          lastProcessedAt = Date.now();
        }
      }
    } catch {}

    const state = get();
    set({
      positions,
      filter: uiState.filter,
      cameraPreset: uiState.cameraPreset,
      validation,
      dataHash,
      dataLoaded: true,
      lastProcessedAt: lastProcessedAt ?? Date.now(),
      exportRecords,
      ...recompute({ ...state, positions, filter: uiState.filter } as TermWallState),
    });
  },

  setFilter: (partial) => {
    const state = get();
    const newFilter = { ...state.filter, ...partial };
    const nextState = { ...state, filter: newFilter };
    saveUIState({ filter: newFilter, cameraPreset: state.cameraPreset });
    set({ filter: newFilter, ...recompute(nextState as TermWallState) });
  },

  resetFilter: () => {
    const state = get();
    const newFilter = { ...defaultFilter };
    saveUIState({ filter: newFilter, cameraPreset: state.cameraPreset });
    const nextState = { ...state, filter: newFilter };
    set({ filter: newFilter, ...recompute(nextState as TermWallState) });
  },

  selectBlock: (block) => set({ selectedBlock: block }),
  hoverBlock: (block) => set({ hoveredBlock: block }),
  setCameraPreset: (preset) => {
    const state = get();
    saveUIState({ filter: state.filter, cameraPreset: preset });
    set({ cameraPreset: preset });
  },

  openDrillDown: (block) =>
    set({ drillDownOpen: true, selectedBlock: block }),
  closeDrillDown: () => set({ drillDownOpen: false }),

  openSliceView: (month) =>
    set({ sliceViewOpen: true, sliceMonth: month }),
  closeSliceView: () => set({ sliceViewOpen: false, sliceMonth: null }),

  toggleFilterPanel: () =>
    set((s) => ({ filterPanelOpen: !s.filterPanelOpen })),
  toggleDataPanel: () =>
    set((s) => ({ dataPanelOpen: !s.dataPanelOpen })),

  exportCSV: async () => {
    const state = get();
    const { filteredPositions, aggregatedBlocks, filter, dataHash } = state;
    const duplicateIds = new Set<string>();
    for (const b of aggregatedBlocks) {
      if (b.duplicateCount > 0) {
        for (const id of b.recordIds) duplicateIds.add(id);
      }
    }
    const header =
      "ID,客户ID,客户名称,品种代码,品种名称,合约月份,方向,保证金,数量,风险报告,是否重复";
    const rows = filteredPositions.map(
      (r) =>
        `${r.id},${r.clientId},${r.clientName ?? ""},${r.varietyCode},${r.varietyName ?? ""},${r.contractMonth ?? ""},${r.direction ?? ""},${r.margin ?? ""},${r.quantity ?? ""},${r.riskReport ?? ""},${duplicateIds.has(r.id) ? "是" : "否"}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `期限墙导出_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    const record: ExportRecord = {
      id: `exp_${Date.now()}`,
      timestamp: Date.now(),
      filterSnapshot: filter,
      dataHash,
      fileName: a.download,
      format: "csv",
    };
    await saveExportRecord(record);
    set((s) => ({ exportRecords: [...s.exportRecords, record] }));
  },

  exportPNG: async () => {
    const state = get();
    const { filter, dataHash } = state;
    const canvas3d = document.querySelector("canvas");
    if (!canvas3d) return;

    const dataUrl = canvas3d.toDataURL("image/png");
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = dataUrl;
    a.download = `期限墙截图_${ts}.png`;
    a.click();

    const record: ExportRecord = {
      id: `exp_${Date.now()}`,
      timestamp: Date.now(),
      filterSnapshot: filter,
      dataHash,
      fileName: a.download,
      format: "png",
    };
    await saveExportRecord(record);
    set((s) => ({ exportRecords: [...s.exportRecords, record] }));
  },
}));
