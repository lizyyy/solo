import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Conclusion,
  ConclusionSnapshot,
  Filters,
  SourceRow,
  UISelection,
  VersionNode,
} from "@/types";
import { INITIAL_SOURCE_ROWS, VERSION_V1_ID, VERSION_V2_ID } from "@/data/sourceRows";
import {
  buildCollisionPoints,
  buildVersionNodes,
  calcVersionConclusion,
  filterSourceRows,
} from "@/logic/collisions";

interface State {
  sourceRows: SourceRow[];
  currentVersionId: string;
  versions: VersionNode[];
  snapshots: ConclusionSnapshot[];
  filters: Filters;
  ui: UISelection;
  importDrawerOpen: boolean;
  importPreviewRows: SourceRow[];
  operatorName: string;
  getRowsAtVersion: (versionId: string) => SourceRow[];
  getVisibleState: () => ReturnType<typeof computeVisible>;
}

interface Actions {
  initMondayScenario: () => void;
  setCurrentVersion: (id: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  toggleZoneFilter: (zoneId: string) => void;
  toggleLevelFilter: (lvl: Filters["levels"][number]) => void;
  toggleSourceFilter: (t: Filters["sourceTypes"][number]) => void;
  setKeyword: (kw: string) => void;
  setSelectedCollision: (id: string | null) => void;
  toggleZoneSelected: (zoneId: string) => void;
  toggleSourceRowExpanded: (id: string) => void;
  setRightTab: (t: UISelection["rightTab"]) => void;
  openImportDrawer: (rows?: SourceRow[]) => void;
  closeImportDrawer: () => void;
  confirmImport: () => void;
  setConclusion: (
    versionId: string,
    next: Conclusion,
    reason: string,
    note: string,
  ) => void;
  getRowsAtVersion: (versionId: string) => SourceRow[];
  getVisibleState: () => ReturnType<typeof computeVisible>;
}

const computeVisible = (s: State) => {
  const rowsAt = s
    .getRowsAtVersion(s.currentVersionId)
    .filter(() => true);
  const allCollisions = buildCollisionPoints(rowsAt);
  const { rows, collisions } = filterSourceRows(
    rowsAt,
    allCollisions,
    s.filters,
  );
  const version =
    s.versions.find((v) => v.id === s.currentVersionId) ?? s.versions[0];
  const conclusion = version
    ? version.conclusion
    : calcVersionConclusion(collisions);
  return {
    rowsAt,
    allCollisions,
    filteredRows: rows,
    filteredCollisions: collisions,
    version,
    conclusion,
  };
};

export const usePreviewStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      sourceRows: [],
      currentVersionId: VERSION_V1_ID,
      versions: [],
      snapshots: [],
      filters: {
        zones: [],
        levels: [],
        sourceTypes: [],
        keyword: "",
      },
      ui: {
        selectedCollisionId: null,
        selectedZoneIds: [],
        expandedSourceRows: [],
        rightTab: "collisions",
      },
      importDrawerOpen: false,
      importPreviewRows: [],
      operatorName: "建筑师 小赵",

      initMondayScenario: () => {
        const rows = [...INITIAL_SOURCE_ROWS];
        const v1Rows = rows.filter((r) => r.versionId === VERSION_V1_ID);
        const v1Cols = buildCollisionPoints(v1Rows);
        const v1Conclusion = calcVersionConclusion(v1Cols);
        const v2AllRows = rows;
        const v2Cols = buildCollisionPoints(v2AllRows);
        const v2Conclusion = calcVersionConclusion(v2Cols);

        const snapshots: ConclusionSnapshot[] = [
          {
            id: "snap-001",
            versionId: VERSION_V1_ID,
            conclusion: v1Conclusion,
            operatorName: "建筑师 小赵",
            reason: "初判：存在1处严重（重复来源）+ 2处警告，需进一步复核",
            note: "3F-01 处重复来源已在交底清单中二次确认，待设计院出修改图",
            previousMaterialsSnapshot: [],
            newMaterialsAdded: v1Rows,
            createdAt: new Date("2026-06-08T18:40:00+08:00").getTime(),
          },
          {
            id: "snap-002",
            versionId: VERSION_V2_ID,
            conclusion: v2Conclusion,
            previousConclusion: v1Conclusion,
            operatorName: "建筑师 小赵",
            reason:
              "补录2026-06-09晚到附件显示：3F-01 防火卷帘侧槽150mm侵入F2，导致严重碰撞数由2升至3，按规则改判为不通过",
            note:
              "已同步通知结构与消防专业，周二前提交修改版；F4×F5 脏数据（F5前有空格）保留原始值不清洗",
            previousMaterialsSnapshot: v1Rows,
            newMaterialsAdded: rows.filter((r) => r.versionId === VERSION_V2_ID),
            createdAt: new Date("2026-06-09T21:22:00+08:00").getTime(),
          },
        ];

        set({
          sourceRows: rows,
          currentVersionId: VERSION_V2_ID,
          versions: buildVersionNodes(rows, snapshots),
          snapshots,
        });
      },

      setCurrentVersion: (id) => set({ currentVersionId: id }),

      setFilters: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch } })),

      resetFilters: () =>
        set({
          filters: { zones: [], levels: [], sourceTypes: [], keyword: "" },
        }),

      toggleZoneFilter: (zoneId) =>
        set((s) => ({
          filters: {
            ...s.filters,
            zones: s.filters.zones.includes(zoneId)
              ? s.filters.zones.filter((z) => z !== zoneId)
              : [...s.filters.zones, zoneId],
          },
        })),

      toggleLevelFilter: (lvl) =>
        set((s) => ({
          filters: {
            ...s.filters,
            levels: s.filters.levels.includes(lvl)
              ? s.filters.levels.filter((x) => x !== lvl)
              : [...s.filters.levels, lvl],
          },
        })),

      toggleSourceFilter: (t) =>
        set((s) => ({
          filters: {
            ...s.filters,
            sourceTypes: s.filters.sourceTypes.includes(t)
              ? s.filters.sourceTypes.filter((x) => x !== t)
              : [...s.filters.sourceTypes, t],
          },
        })),

      setKeyword: (kw) => set((s) => ({ filters: { ...s.filters, keyword: kw } })),

      setSelectedCollision: (id) =>
        set((s) => ({ ui: { ...s.ui, selectedCollisionId: id } })),

      toggleZoneSelected: (zoneId) =>
        set((s) => ({
          ui: {
            ...s.ui,
            selectedZoneIds: s.ui.selectedZoneIds.includes(zoneId)
              ? s.ui.selectedZoneIds.filter((z) => z !== zoneId)
              : [...s.ui.selectedZoneIds, zoneId],
          },
        })),

      toggleSourceRowExpanded: (id) =>
        set((s) => ({
          ui: {
            ...s.ui,
            expandedSourceRows: s.ui.expandedSourceRows.includes(id)
              ? s.ui.expandedSourceRows.filter((x) => x !== id)
              : [...s.ui.expandedSourceRows, id],
          },
        })),

      setRightTab: (t) => set((s) => ({ ui: { ...s.ui, rightTab: t } })),

      openImportDrawer: (rows) =>
        set({ importDrawerOpen: true, importPreviewRows: rows ?? [] }),

      closeImportDrawer: () => set({ importDrawerOpen: false }),

      confirmImport: () => {
        const s = get();
        const adding = s.importPreviewRows;
        if (!adding.length) {
          set({ importDrawerOpen: false });
          return;
        }
        const nextRows = [...s.sourceRows, ...adding];
        const nextVersions = buildVersionNodes(nextRows, s.snapshots);
        const latest = nextVersions[nextVersions.length - 1];
        set({
          sourceRows: nextRows,
          versions: nextVersions,
          currentVersionId: latest?.id ?? s.currentVersionId,
          importDrawerOpen: false,
          importPreviewRows: [],
        });
      },

      setConclusion: (versionId, next, reason, note) => {
        const s = get();
        const version = s.versions.find((v) => v.id === versionId);
        const prev = version?.conclusion;
        const rowsAt = s.getRowsAtVersion(versionId);
        const snap: ConclusionSnapshot = {
          id: `snap-${Date.now().toString(36)}`,
          versionId,
          conclusion: next,
          previousConclusion: prev,
          operatorName: s.operatorName,
          reason,
          note,
          previousMaterialsSnapshot: s.snapshots.length
            ? s.snapshots[s.snapshots.length - 1].previousMaterialsSnapshot.concat(
                s.snapshots[s.snapshots.length - 1].newMaterialsAdded,
              )
            : [],
          newMaterialsAdded: rowsAt.filter(
            (r) => r.versionId === versionId,
          ),
          createdAt: Date.now(),
        };
        const nextSnaps = [...s.snapshots, snap];
        const nextVersions = s.versions.map((v) =>
          v.id === versionId ? { ...v, conclusion: next } : v,
        );
        set({ versions: nextVersions, snapshots: nextSnaps });
      },

      getRowsAtVersion: (versionId) => {
        const s = get();
        const sorted = [...s.versions].sort((a, b) => a.createdAt - b.createdAt);
        const idx = sorted.findIndex((v) => v.id === versionId);
        if (idx < 0) return s.sourceRows;
        const active = sorted.slice(0, idx + 1).map((v) => v.id);
        const activeSet = new Set(active);
        return s.sourceRows.filter((r) => activeSet.has(r.versionId));
      },

      getVisibleState: () => computeVisible(get()),
    }),
    {
      name: "fire-zone-preview-store",
      partialize: (s) => ({
        sourceRows: s.sourceRows,
        currentVersionId: s.currentVersionId,
        snapshots: s.snapshots,
      }),
    },
  ),
);
