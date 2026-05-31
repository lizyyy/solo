import { create } from 'zustand';
import { produce } from 'immer';
import {
  AirspaceRecord,
  HistoryEntry,
  NoFlyZoneIssue,
  RouteVersion,
  RecordStatus,
  ActionType,
  RouteData,
  NoFlyZone,
  Stats,
  NoFlyZoneSourceType,
} from '../types';
import { useIndexedDB } from '../hooks/useIndexedDB';
import { generateKML, parseKML } from '../utils/kml';
import { mockRecords, mockHistory, mockIssues, mockRouteVersions, mockNoFlyZones } from '../mock/initialData';

function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
}

interface RecordsState {
  records: AirspaceRecord[];
  history: HistoryEntry[];
  issues: NoFlyZoneIssue[];
  routeVersions: RouteVersion[];
  noFlyZones: NoFlyZone[];
  selectedRecordId: string | null;
  compareRouteVersionIds: string[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  initData: () => Promise<void>;
  resetData: () => Promise<void>;
  fetchAll: () => Promise<void>;
  selectRecord: (id: string | null) => void;
  toggleCompareVersion: (versionId: string) => void;
  clearCompareVersions: () => void;

  addRecord: (
    recordData: Partial<AirspaceRecord>,
    routeData: RouteData,
    operator: string
  ) => Promise<AirspaceRecord>;

  updateRecordStatus: (
    id: string,
    status: RecordStatus,
    operator: string,
    reason?: string,
    pendingReason?: string
  ) => Promise<void>;

  addRouteVersion: (
    recordId: string,
    kmlData: string,
    changeDescription: string,
    operator: string
  ) => Promise<RouteVersion>;

  modifyRoute: (
    recordId: string,
    modifier: (coords: RouteData['coordinates']) => RouteData['coordinates'],
    changeDescription: string,
    operator: string
  ) => Promise<RouteVersion>;

  addNoFlyZoneIssue: (
    recordId: string,
    sourceType: NoFlyZoneSourceType,
    location: { lat: number; lng: number; alt: number },
    description: string,
    assignee: string,
    operator: string,
    photoUrl?: string
  ) => Promise<NoFlyZoneIssue>;

  resolveIssue: (issueId: string, operator: string) => Promise<void>;

  addHistoryEntry: (
    recordId: string,
    action: ActionType,
    operator: string,
    reason?: string,
    previousState?: string,
    newState?: string,
    metadata?: Record<string, any>
  ) => Promise<void>;

  getSelectedRecord: () => AirspaceRecord | undefined;
  getSelectedRecordHistory: () => HistoryEntry[];
  getSelectedRecordIssues: () => NoFlyZoneIssue[];
  getSelectedRecordRouteVersions: () => RouteVersion[];
  getCurrentRouteVersion: (recordId: string) => RouteVersion | undefined;
  getStats: () => Stats;
  getCompareRoutes: () => RouteVersion[];
}

export const useRecordsStore = create<RecordsState>((set, get) => {
  const db = useIndexedDB();

  return {
    records: [],
    history: [],
    issues: [],
    routeVersions: [],
    noFlyZones: mockNoFlyZones,
    selectedRecordId: null,
    compareRouteVersionIds: [],
    loading: false,
    initialized: false,
    error: null,

    initData: async () => {
      if (get().initialized) return;

      set({ loading: true, error: null });
      try {
        const allData = await db.getAllData();
        const hasAnyData =
          allData.records.length > 0 ||
          allData.history.length > 0 ||
          allData.issues.length > 0 ||
          allData.routeVersions.length > 0;

        if (!hasAnyData) {
          for (const record of mockRecords) {
            await db.updateRecord(record);
          }
          for (const entry of mockHistory) {
            await db.updateHistoryEntry(entry);
          }
          for (const issue of mockIssues) {
            await db.updateIssue(issue);
          }
          for (const version of mockRouteVersions) {
            await db.updateRouteVersion(version);
          }
        }

        await get().fetchAll();
        set({ initialized: true });
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    resetData: async () => {
      set({ loading: true, error: null });
      try {
        await db.clearAll();
        set({
          records: [],
          history: [],
          issues: [],
          routeVersions: [],
          selectedRecordId: null,
          compareRouteVersionIds: [],
          initialized: false,
        });
        await get().initData();
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    fetchAll: async () => {
      set({ loading: true });
      try {
        const [records, history, issues, routeVersions] = await Promise.all([
          db.getAllRecords(),
          db.getAllData().then((d) => d.history),
          db.getAllData().then((d) => d.issues),
          db.getAllData().then((d) => d.routeVersions),
        ]);

        set({
          records: records.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
          history,
          issues,
          routeVersions,
        });
      } catch (error) {
        set({ error: (error as Error).message });
      } finally {
        set({ loading: false });
      }
    },

    selectRecord: (id) => set({ selectedRecordId: id, compareRouteVersionIds: [] }),

    toggleCompareVersion: (versionId) => {
      const current = get().compareRouteVersionIds;
      if (current.includes(versionId)) {
        set({ compareRouteVersionIds: current.filter((id) => id !== versionId) });
      } else if (current.length < 2) {
        set({ compareRouteVersionIds: [...current, versionId] });
      }
    },

    clearCompareVersions: () => set({ compareRouteVersionIds: [] }),

    addRecord: async (recordData, routeData, operator) => {
      const now = new Date().toISOString();
      const recordId = generateId('REC-');
      const versionId = generateId('RV-');

      const kmlData = generateKML(routeData);

      const record: AirspaceRecord = {
        id: recordId,
        source: recordData.source || '手动创建',
        status: 'pending_review',
        batteryCycle: recordData.batteryCycle || 0,
        pilot: recordData.pilot || operator,
        createdAt: now,
        updatedAt: now,
        currentRouteVersionId: versionId,
      };

      const routeVersion: RouteVersion = {
        id: versionId,
        recordId,
        kmlData,
        routeData,
        createdAt: now,
        createdBy: operator,
        changeDescription: '初始创建',
        version: 1,
      };

      await db.addRecord(record);
      await db.addRouteVersion(routeVersion);

      await get().addHistoryEntry(recordId, 'create', operator, '创建新记录');

      await get().fetchAll();
      return record;
    },

    updateRecordStatus: async (id, status, operator, reason, pendingReason) => {
      const record = await db.getRecordById(id);
      if (!record) return;

      const previousState = record.status;

      const updatedRecord = produce(record, (draft) => {
        draft.status = status;
        draft.updatedAt = new Date().toISOString();
        if (pendingReason !== undefined) {
          draft.pendingReason = pendingReason;
        }
      });

      await db.updateRecord(updatedRecord);
      await get().addHistoryEntry(
        id,
        'status_change',
        operator,
        reason,
        previousState,
        status
      );

      await get().fetchAll();
    },

    addRouteVersion: async (recordId, kmlData, changeDescription, operator) => {
      const record = await db.getRecordById(recordId);
      if (!record) throw new Error('记录不存在');

      const existingVersions = await db.getRouteVersionsByRecordId(recordId);
      const maxVersion = Math.max(...existingVersions.map((v) => v.version), 0);

      const now = new Date().toISOString();
      const versionId = generateId('RV-');

      const routeVersion: RouteVersion = {
        id: versionId,
        recordId,
        kmlData,
        routeData: parseKML(kmlData),
        createdAt: now,
        createdBy: operator,
        changeDescription,
        version: maxVersion + 1,
      };

      await db.addRouteVersion(routeVersion);

      const updatedRecord = produce(record, (draft) => {
        draft.currentRouteVersionId = versionId;
        draft.updatedAt = now;
      });
      await db.updateRecord(updatedRecord);

      await get().addHistoryEntry(
        recordId,
        'route_modify',
        operator,
        changeDescription,
        `版本${maxVersion}`,
        `版本${maxVersion + 1}`
      );

      await get().fetchAll();
      return routeVersion;
    },

    modifyRoute: async (recordId, modifier, changeDescription, operator) => {
      const currentVersion = get().getCurrentRouteVersion(recordId);
      if (!currentVersion) throw new Error('当前航线版本不存在');

      const newCoords = modifier(currentVersion.routeData.coordinates);
      const newRouteData = {
        ...currentVersion.routeData,
        coordinates: newCoords,
      };
      const newKml = generateKML(newRouteData);

      return get().addRouteVersion(recordId, newKml, changeDescription, operator);
    },

    addNoFlyZoneIssue: async (
      recordId,
      sourceType,
      location,
      description,
      assignee,
      operator,
      photoUrl
    ) => {
      const issue: NoFlyZoneIssue = {
        id: generateId('ISSUE-'),
        recordId,
        sourceType,
        location,
        description,
        assignee,
        status: 'open',
        photoUrl,
        createdAt: new Date().toISOString(),
      };

      await db.addIssue(issue);
      await get().addHistoryEntry(
        recordId,
        'issue_create',
        operator,
        description,
        undefined,
        undefined,
        { sourceType, issueId: issue.id }
      );

      await get().fetchAll();
      return issue;
    },

    resolveIssue: async (issueId, operator) => {
      const allIssues = await db.getAllData().then((d) => d.issues);
      const issue = allIssues.find((i) => i.id === issueId);
      if (!issue) return;

      const updatedIssue = produce(issue, (draft) => {
        draft.status = 'resolved';
        draft.resolvedAt = new Date().toISOString();
      }) as unknown as NoFlyZoneIssue;

      await db.updateIssue(updatedIssue);
      await get().addHistoryEntry(
        issue.recordId,
        'issue_resolve',
        operator,
        `解决问题: ${issue.description}`
      );

      await get().fetchAll();
    },

    addHistoryEntry: async (recordId, action, operator, reason, previousState, newState, metadata) => {
      const entry: HistoryEntry = {
        id: generateId('HIST-'),
        recordId,
        action,
        operator,
        timestamp: new Date().toISOString(),
        reason,
        previousState,
        newState,
        metadata,
      };

      await db.addHistoryEntry(entry);
      await get().fetchAll();
    },

    getSelectedRecord: () => {
      return get().records.find((r) => r.id === get().selectedRecordId);
    },

    getSelectedRecordHistory: () => {
      return get()
        .history.filter((h) => h.recordId === get().selectedRecordId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    getSelectedRecordIssues: () => {
      return get().issues.filter((i) => i.recordId === get().selectedRecordId);
    },

    getSelectedRecordRouteVersions: () => {
      return get()
        .routeVersions.filter((v) => v.recordId === get().selectedRecordId)
        .sort((a, b) => a.version - b.version);
    },

    getCurrentRouteVersion: (recordId) => {
      const record = get().records.find((r) => r.id === recordId);
      if (!record) return undefined;
      return get().routeVersions.find((v) => v.id === record.currentRouteVersionId);
    },

    getStats: () => {
      const records = get().records;
      return {
        pendingReview: records.filter((r) => r.status === 'pending_review').length,
        reviewed: records.filter((r) => r.status === 'reviewed').length,
        pendingProcessing: records.filter((r) => r.status === 'pending_processing').length,
        issues: get().issues.filter((i) => i.status === 'open').length,
        totalBatteryCycles: records.reduce((sum, r) => sum + r.batteryCycle, 0),
      };
    },

    getCompareRoutes: () => {
      return get().routeVersions.filter((v) => get().compareRouteVersionIds.includes(v.id));
    },
  };
});
