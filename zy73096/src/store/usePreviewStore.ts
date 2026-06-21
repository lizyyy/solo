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

interface ImportNotification {
  type: "info" | "warn" | "error";
  message: string;
}

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
  notification: ImportNotification | null;
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
  clearNotification: () => void;
  getRowsAtVersion: (versionId: string) => SourceRow[];
  getVisibleState: () => ReturnType<typeof computeVisible>;
  hasImportedVersion: (versionId: string) => boolean;
  resetStore: () => void;
}

const computeVisible = (s: State) => {
  const rowsAt = s.currentVersionId
    ? s.getRowsAtVersion(s.currentVersionId)
    : [];
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
    : allCollisions.length
      ? calcVersionConclusion(allCollisions)
      : "pass";
  return {
    rowsAt,
    allCollisions,
    filteredRows: rows,
    filteredCollisions: collisions,
    version,
    conclusion,
  };
};

const V1_BATCH_ROWS = INITIAL_SOURCE_ROWS.filter(
  (r) => r.versionId === VERSION_V1_ID,
);
const V2_BATCH_ROWS = INITIAL_SOURCE_ROWS.filter(
  (r) => r.versionId === VERSION_V2_ID,
);

export const usePreviewStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      sourceRows: [],
      currentVersionId: "",
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
      notification: null,

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

      hasImportedVersion: (versionId) => {
        return get().sourceRows.some((r) => r.versionId === versionId);
      },

      initMondayScenario: () => {
        set({
          sourceRows: [],
          currentVersionId: "",
          versions: [],
          snapshots: [],
          filters: { zones: [], levels: [], sourceTypes: [], keyword: "" },
          ui: {
            selectedCollisionId: null,
            selectedZoneIds: [],
            expandedSourceRows: [],
            rightTab: "collisions",
          },
          notification: null,
        });
      },

      resetStore: () => {
        try {
          localStorage.removeItem("fire-zone-preview-store");
        } catch {
          // ignore
        }
        get().initMondayScenario();
      },

      setCurrentVersion: (id) => {
        set({
          currentVersionId: id,
          ui: {
            ...get().ui,
            selectedCollisionId: null,
            expandedSourceRows: [],
          },
        });
      },

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

      setSelectedCollision: (id) => {
        const s = get();
        if (id) {
          const col = s
            .getVisibleState()
            .allCollisions.find((c) => c.id === id);
          const zoneIds = col ? [col.zoneA, col.zoneB] : [];
          set({
            ui: {
              ...s.ui,
              selectedCollisionId: id,
              selectedZoneIds: zoneIds,
              rightTab: "collisions",
              expandedSourceRows: col ? [...col.sourceRows] : [],
            },
          });
          if (col) {
            const versionNode = s.versions.find(
              (v) => v.id === col.lastUpdatedVersionId,
            );
            if (versionNode && s.currentVersionId !== versionNode.id) {
              set({ currentVersionId: versionNode.id });
            }
          }
        } else {
          set({
            ui: {
              ...s.ui,
              selectedCollisionId: null,
              selectedZoneIds: [],
              expandedSourceRows: [],
            },
          });
        }
      },

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

      openImportDrawer: (rows) => {
        if (!rows || !rows.length) return;
        const previewVersionId = rows[0].versionId;
        const s = get();
        const existingIds = new Set(s.sourceRows.map((r) => r.id));
        const duplicates = rows.filter((r) => existingIds.has(r.id));
        if (duplicates.length === rows.length) {
          set({
            notification: {
              type: "warn",
              message: `该批次（${previewVersionId.startsWith("ver-v1") ? "旧材料 V1" : "晚到附件 V2"}）已全部导入，无需重复操作。`,
            },
          });
          return;
        }
        const filteredRows = rows.filter((r) => !existingIds.has(r.id));
        set({
          importDrawerOpen: true,
          importPreviewRows: filteredRows,
          notification:
            duplicates.length > 0
              ? {
                  type: "info",
                  message: `检测到 ${duplicates.length} 条重复数据，已自动过滤，仅导入 ${filteredRows.length} 条新数据。`,
                }
              : null,
        });
      },

      closeImportDrawer: () => set({ importDrawerOpen: false }),

      clearNotification: () => set({ notification: null }),

      confirmImport: () => {
        const s = get();
        const adding = s.importPreviewRows;
        if (!adding.length) {
          set({ importDrawerOpen: false });
          return;
        }

        const existingIds = new Set(s.sourceRows.map((r) => r.id));
        const deduped = adding.filter((r) => !existingIds.has(r.id));
        if (!deduped.length) {
          set({
            importDrawerOpen: false,
            importPreviewRows: [],
            notification: {
              type: "warn",
              message: "所有数据均已存在，未新增任何记录。",
            },
          });
          return;
        }

        const batchVersionId = deduped[0].versionId;
        const isV1 = batchVersionId === VERSION_V1_ID;
        const isV2 = batchVersionId === VERSION_V2_ID;

        const prevAllRows = s.sourceRows;
        const nextRows = [...prevAllRows, ...deduped];
        const prevSnapshots = s.snapshots;

        const tempVersionsPre = buildVersionNodes(prevAllRows, prevSnapshots);
        const prevVersion = tempVersionsPre.find(
          (v) => v.id === batchVersionId,
        );
        const prevConclusion = prevVersion?.conclusion;

        const nextVersions = buildVersionNodes(nextRows, prevSnapshots);
        const newVersion = nextVersions.find((v) => v.id === batchVersionId);
        const newConclusion = newVersion?.conclusion ?? "pass";

        const nextSnapshots = [...prevSnapshots];

        if (isV1) {
          const v1Rows = deduped;
          const snap: ConclusionSnapshot = {
            id: `snap-${Date.now().toString(36)}-v1`,
            versionId: VERSION_V1_ID,
            conclusion: newConclusion,
            previousConclusion: undefined,
            operatorName: s.operatorName,
            reason:
              "初判：导入旧材料 5 条，检测到 1 处严重碰撞（重复来源）+ 2 处警告，需进一步复核",
            note: "3F-01 处重复来源已在交底清单中二次确认，待设计院出修改图",
            previousMaterialsSnapshot: [],
            newMaterialsAdded: v1Rows,
            createdAt: new Date("2026-06-08T18:40:00+08:00").getTime(),
          };
          nextSnapshots.push(snap);
        }

        if (isV2) {
          const v2Rows = deduped;
          const v1RowsInStore = nextRows.filter(
            (r) => r.versionId === VERSION_V1_ID,
          );
          const snap: ConclusionSnapshot = {
            id: `snap-${Date.now().toString(36)}-v2`,
            versionId: VERSION_V2_ID,
            conclusion: newConclusion,
            previousConclusion: prevConclusion,
            operatorName: s.operatorName,
            reason:
              "补录2026-06-09晚到附件显示：3F-01 防火卷帘侧槽150mm侵入F2，严重碰撞数由2升至3，按规则改判为不通过",
            note:
              "已同步通知结构与消防专业，周二前提交修改版；F4×F5 脏数据（F5前有空格）保留原始值不清洗",
            previousMaterialsSnapshot: v1RowsInStore,
            newMaterialsAdded: v2Rows,
            createdAt: new Date("2026-06-09T21:22:00+08:00").getTime(),
          };
          nextSnapshots.push(snap);
        }

        const finalVersions = buildVersionNodes(nextRows, nextSnapshots);

        set({
          sourceRows: nextRows,
          versions: finalVersions,
          currentVersionId: batchVersionId,
          snapshots: nextSnapshots,
          importDrawerOpen: false,
          importPreviewRows: [],
          filters: { zones: [], levels: [], sourceTypes: [], keyword: "" },
          ui: {
            selectedCollisionId: null,
            selectedZoneIds: [],
            expandedSourceRows: [],
            rightTab: isV2 ? "history" : "collisions",
          },
          notification: {
            type: "info",
            message: `成功导入 ${deduped.length} 条${isV1 ? "旧材料" : "晚到附件"}数据 · ${newConclusion === "fail" ? "结论：不通过" : newConclusion === "doubt" ? "结论：有疑点" : "结论：通过"}`,
          },
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
          previousMaterialsSnapshot: rowsAt.filter(
            (r) => r.versionId !== versionId,
          ),
          newMaterialsAdded: rowsAt.filter((r) => r.versionId === versionId),
          createdAt: Date.now(),
        };
        const nextSnaps = [...s.snapshots, snap];
        const nextVersions = s.versions.map((v) =>
          v.id === versionId ? { ...v, conclusion: next } : v,
        );
        set({ versions: nextVersions, snapshots: nextSnaps });
      },
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

export { V1_BATCH_ROWS, V2_BATCH_ROWS };
