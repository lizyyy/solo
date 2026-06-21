import { create } from 'zustand';
import type { WaterQualityRecord, RecordStatus, ParameterScheme, TimelineEvent, EventType } from '@/types';
import { mockRecords, getCleaningStepsByScheme, getCleanedValueByScheme } from '@/data/records';
import { mockSchemes } from '@/data/schemes';
import { generateInitialTimeline, getTimelineByRecordId } from '@/data/timeline';

interface AppState {
  records: WaterQualityRecord[];
  selectedRecordId: string | null;
  schemes: ParameterScheme[];
  activeSchemeId: string;
  compareSchemeId: string | null;
  compareMode: boolean;
  timelineEvents: TimelineEvent[];

  setSelectedRecord: (id: string | null) => void;
  setActiveScheme: (id: string) => void;
  setCompareScheme: (id: string | null) => void;
  toggleCompareMode: () => void;
  updateRecordStatus: (id: string, status: RecordStatus) => void;
  getSelectedRecord: () => WaterQualityRecord | undefined;
  getRecordsByStatus: (status: RecordStatus) => WaterQualityRecord[];
  getMissingEvidenceCount: () => number;
  getRecordTimeline: (recordId: string) => TimelineEvent[];
  getCleanedValueForScheme: (recordId: string, schemeId: string) => number;
  getCleaningStepsForScheme: (recordId: string, schemeId: string) => { schemeId: string; steps: typeof mockRecords[0]['cleaningSteps'] }[];
  addTimelineEvent: (event: Omit<TimelineEvent, 'id' | 'eventTime'>) => void;
  handleDriftSuspend: (recordId: string, reason: string) => void;
  handleDriftRelease: (recordId: string, reason: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: mockRecords,
  selectedRecordId: 'rec-002',
  schemes: mockSchemes,
  activeSchemeId: 'scheme-standard',
  compareSchemeId: null,
  compareMode: false,
  timelineEvents: generateInitialTimeline(),

  setSelectedRecord: (id) => set({ selectedRecordId: id }),

  setActiveScheme: (id) => set({ activeSchemeId: id }),

  setCompareScheme: (id) => set({ compareSchemeId: id }),

  toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),

  updateRecordStatus: (id, status) =>
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
    })),

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find((r) => r.id === selectedRecordId);
  },

  getRecordsByStatus: (status) => {
    return get().records.filter((r) => r.status === status);
  },

  getMissingEvidenceCount: () => {
    return get().records.reduce((count, r) => count + r.missingEvidence.length, 0);
  },

  getRecordTimeline: (recordId) => {
    return getTimelineByRecordId(recordId, get().timelineEvents);
  },

  getCleanedValueForScheme: (recordId, schemeId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return 0;
    return getCleanedValueByScheme(record, schemeId);
  },

  getCleaningStepsForScheme: (recordId, schemeId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return [];
    
    const schemes = [schemeId];
    if (get().compareMode && get().compareSchemeId) {
      schemes.push(get().compareSchemeId!);
    }
    
    return schemes.map((sid) => ({
      schemeId: sid,
      steps: getCleaningStepsByScheme(record, sid),
    }));
  },

  addTimelineEvent: (event) => {
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      eventTime: now,
    };
    set((state) => ({
      timelineEvents: [...state.timelineEvents, newEvent],
    }));
  },

  handleDriftSuspend: (recordId, reason) => {
    const { records, addTimelineEvent } = get();
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const defaultEvidence = ['传感器校准记录', '现场重测数据'];
    const newMissingEvidence = [...new Set([...record.missingEvidence, ...defaultEvidence])];

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? { ...r, status: 'supplement', missingEvidence: newMissingEvidence }
          : r
      ),
    }));

    addTimelineEvent({
      recordId,
      eventType: 'drift' as EventType,
      operator: '老何',
      description: `挂起待补：${reason}`,
      detail: { decision: 'suspend', reason, driftAmount: record.driftAmount },
    });

    addTimelineEvent({
      recordId,
      eventType: 'status_change' as EventType,
      operator: '老何',
      description: `状态从${record.status}变更为待补件，需补充：${newMissingEvidence.join('、')}`,
      detail: { from: record.status, to: 'supplement', missingEvidence: newMissingEvidence },
    });
  },

  handleDriftRelease: (recordId, reason) => {
    const { records, addTimelineEvent } = get();
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? { ...r, status: 'confirmed', missingEvidence: [] }
          : r
      ),
    }));

    addTimelineEvent({
      recordId,
      eventType: 'drift' as EventType,
      operator: '老何',
      description: `校正放行：${reason}`,
      detail: { decision: 'release', reason, driftAmount: record.driftAmount },
    });

    addTimelineEvent({
      recordId,
      eventType: 'status_change' as EventType,
      operator: '老何',
      description: `状态从${record.status}变更为已确认，校正后数据有效`,
      detail: { from: record.status, to: 'confirmed' },
    });
  },
}));
