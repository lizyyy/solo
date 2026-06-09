import { create } from 'zustand';
import type {
  ConclusionStatus,
  HistoryEvent,
  Material,
  MaterialSource,
  PageSummary,
  SourceFilterSet,
  VersionNode,
  Zone,
} from '@/types';
import { HISTORY_EVENTS, VERSIONS, ZONES } from '@/data/mockData';
import {
  computePageSummary,
  computeZoneStatusFromMaterials,
  isZoneVisibleInVersion,
  uid,
} from '@/utils/conclusion';

interface ReviewState {
  versions: VersionNode[];
  zones: Zone[];
  history: HistoryEvent[];

  currentVersionTag: string;
  sourceFilter: SourceFilterSet;
  selectedZoneId: string | null;
  showHistoryPanel: boolean;
  showDetailPanel: boolean;
  showGuideDrawer: boolean;

  currentVersion: VersionNode;
  visibleZones: Zone[];
  filteredZones: Zone[];
  selectedZone: Zone | null;
  summary: PageSummary;

  selectVersion: (tag: string) => void;
  toggleSource: (s: MaterialSource) => void;
  selectZone: (id: string | null) => void;
  toggleHistoryPanel: () => void;
  toggleDetailPanel: (open?: boolean) => void;
  toggleGuideDrawer: (open?: boolean) => void;
  addSupplementaryNote: (zoneId: string, title: string, content: string, operator: string) => void;
  jumpHistoryToVersion: (versionTag: string) => void;
  filteredHistoryForZone: HistoryEvent[];
}

function deriveState(state: Partial<ReviewState>): Pick<ReviewState, 'currentVersion' | 'visibleZones' | 'filteredZones' | 'selectedZone' | 'summary'> {
  const versions = state.versions ?? VERSIONS;
  const zones = state.zones ?? ZONES;
  const history = state.history ?? HISTORY_EVENTS;
  const currentVersionTag = state.currentVersionTag ?? versions[versions.length - 1].tag;
  const sourceFilter = state.sourceFilter ?? { cad_old: true, note_added: true, note_oral: true };
  const selectedZoneId = state.selectedZoneId ?? null;

  const currentVersion = versions.find((v) => v.tag === currentVersionTag) ?? versions[versions.length - 1];
  const visibleZones = zones.filter((z) => isZoneVisibleInVersion(z, currentVersionTag));
  const filteredZones = visibleZones.map((z) => ({
    ...z,
    materials: z.materials.filter((m) => sourceFilter[m.source]),
  }));
  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null;
  const summary = computePageSummary(currentVersion, visibleZones, sourceFilter);

  void history;

  return { currentVersion, visibleZones, filteredZones, selectedZone, summary };
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  versions: VERSIONS,
  zones: ZONES,
  history: HISTORY_EVENTS,

  currentVersionTag: VERSIONS[VERSIONS.length - 1].tag,
  sourceFilter: { cad_old: true, note_added: true, note_oral: true },
  selectedZoneId: null,
  showHistoryPanel: false,
  showDetailPanel: false,
  showGuideDrawer: false,

  ...deriveState({}),

  selectVersion: (tag) => {
    set((s) => {
      const next = { ...s, currentVersionTag: tag };
      return { ...next, ...deriveState(next) };
    });
  },

  toggleSource: (s) => {
    set((state) => {
      const next = {
        ...state,
        sourceFilter: { ...state.sourceFilter, [s]: !state.sourceFilter[s] },
      };
      return { ...next, ...deriveState(next) };
    });
  },

  selectZone: (id) => {
    set((state) => {
      const next = {
        ...state,
        selectedZoneId: id,
        showDetailPanel: !!id,
      };
      return { ...next, ...deriveState(next) };
    });
  },

  toggleHistoryPanel: () => {
    set((s) => ({ showHistoryPanel: !s.showHistoryPanel }));
  },

  toggleDetailPanel: (open) => {
    set((s) => ({
      showDetailPanel: typeof open === 'boolean' ? open : !s.showDetailPanel,
    }));
  },

  toggleGuideDrawer: (open) => {
    set((s) => ({
      showGuideDrawer: typeof open === 'boolean' ? open : !s.showGuideDrawer,
    }));
  },

  addSupplementaryNote: (zoneId, title, content, operator) => {
    set((state) => {
      const newMaterial: Material = {
        id: uid('m'),
        source: 'note_added',
        title,
        content,
        recordedAt: new Date().toISOString(),
        operator,
        affectsConclusion: true,
      };

      const zone = state.zones.find((z) => z.id === zoneId);
      if (!zone) return state;

      const oldMaterialsSnapshot = [...zone.materials];

      const materialsWithNew = [...zone.materials, newMaterial];
      const oldStatus: ConclusionStatus =
        (computeZoneStatusFromMaterials(zone.materials, state.sourceFilter) as ConclusionStatus) || 'pending';

      const newStatusComputed = computeZoneStatusFromMaterials(materialsWithNew, state.sourceFilter);
      const newStatus: ConclusionStatus = newStatusComputed === 'unreviewed' ? 'pending' : newStatusComputed;

      const changed = oldStatus !== newStatus || true;

      const newHistory: HistoryEvent | null = changed
        ? {
            id: uid('h'),
            at: new Date().toISOString(),
            zoneId,
            oldConclusion: oldStatus,
            newConclusion: newStatus,
            oldMaterialsSnapshot,
            newNote: `${title} · ${content}`,
            reason: operator ? `补录备注后重新判定（操作人：${operator}）` : '补录备注后重新判定',
            operator,
            relatedVersionTag: state.currentVersionTag,
          }
        : null;

      const newZones = state.zones.map((z) =>
        z.id === zoneId ? { ...z, materials: materialsWithNew, status: newStatus } : z
      );
      const nextHistory = newHistory ? [newHistory, ...state.history] : state.history;

      const next = {
        ...state,
        zones: newZones,
        history: nextHistory,
      };
      return { ...next, ...deriveState(next) };
    });
  },

  jumpHistoryToVersion: (versionTag) => {
    set((state) => {
      const next = { ...state, currentVersionTag: versionTag, showHistoryPanel: true };
      return { ...next, ...deriveState(next) };
    });
  },

  get filteredHistoryForZone() {
    const { history, selectedZoneId } = get();
    if (!selectedZoneId) return history;
    return history.filter((h) => h.zoneId === selectedZoneId);
  },
}));
