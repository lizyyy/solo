import { create } from 'zustand';
import type { Station, Sample, Anomaly, DriftEvent, LogbookEntry, HandoverReport } from '@/types';
import { stations, samples, anomalies, driftEvents, logbookEntries } from '@/data/mockData';

interface AppState {
  stations: Station[];
  samples: Sample[];
  anomalies: Anomaly[];
  driftEvents: DriftEvent[];
  logbookEntries: LogbookEntry[];

  selectedStationId: string | null;
  selectedSampleId: string | null;
  selectedAnomalyId: string | null;
  selectedDriftId: string | null;
  highlightedLogbookId: string | null;

  playheadIndex: number;
  isPlaying: boolean;
  activeView: 'main' | 'report';

  setSelectedStation: (id: string | null) => void;
  setSelectedSample: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setSelectedDrift: (id: string | null) => void;
  setHighlightedLogbook: (id: string | null) => void;

  setPlayheadIndex: (i: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActiveView: (v: 'main' | 'report') => void;

  getFilteredSamples: () => Sample[];
  getSummary: () => {
    processed: number;
    pending: number;
    blocked: number;
    anomalies: number;
    withdrawn: number;
    driftEvents: number;
  };
  getHandoverReport: () => HandoverReport;
  findLogbookById: (id: string) => LogbookEntry | undefined;
  findAnomaliesByStation: (stationId: string) => Anomaly[];
  findDriftsByStation: (stationId: string) => DriftEvent[];
}

export const useAppStore = create<AppState>((set, get) => ({
  stations,
  samples,
  anomalies,
  driftEvents,
  logbookEntries,

  selectedStationId: 'st-02',
  selectedSampleId: null,
  selectedAnomalyId: null,
  selectedDriftId: null,
  highlightedLogbookId: null,

  playheadIndex: 0,
  isPlaying: false,
  activeView: 'main',

  setSelectedStation: (id) => {
    set({ selectedStationId: id, selectedSampleId: null, playheadIndex: 0 });
  },

  setSelectedSample: (id) => {
    const { samples, anomalies } = get();
    const sample = samples.find((s) => s.id === id);
    if (!sample) return;
    const stationSamples = samples.filter((s) => s.stationId === sample.stationId);
    const idx = stationSamples.findIndex((s) => s.id === id);
    const anomaly = anomalies.find((a) => a.sampleId === id);
    set({
      selectedSampleId: id,
      playheadIndex: idx >= 0 ? idx : 0,
      selectedAnomalyId: anomaly ? anomaly.id : null,
      highlightedLogbookId: anomaly ? anomaly.sourceLogbookId : null,
    });
  },

  setSelectedAnomaly: (id) => {
    const { anomalies, samples } = get();
    const anomaly = anomalies.find((a) => a.id === id);
    if (!anomaly) return;
    const stationSamples = samples.filter((s) => s.stationId === anomaly.stationId);
    const idx = stationSamples.findIndex((s) => s.id === anomaly.sampleId);
    set({
      selectedAnomalyId: id,
      selectedStationId: anomaly.stationId,
      selectedSampleId: anomaly.sampleId,
      highlightedLogbookId: anomaly.sourceLogbookId,
      playheadIndex: idx >= 0 ? idx : get().playheadIndex,
    });
  },

  setSelectedDrift: (id) => {
    const { driftEvents } = get();
    const drift = driftEvents.find((d) => d.id === id);
    if (!drift) return;
    set({
      selectedDriftId: id,
      highlightedLogbookId: drift.sourceLogbookId,
      selectedStationId: drift.affectedStationIds.length > 0 ? drift.affectedStationIds[0] : null,
    });
  },

  setHighlightedLogbook: (id) => set({ highlightedLogbookId: id }),
  setPlayheadIndex: (i) => set({ playheadIndex: i }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setActiveView: (v) => set({ activeView: v }),

  getFilteredSamples: () => {
    const { selectedStationId, samples } = get();
    if (!selectedStationId) return samples;
    return samples.filter((s) => s.stationId === selectedStationId);
  },
  getSummary: () => {
    const { samples, anomalies, driftEvents } = get();
    let processed = 0, pending = 0, blocked = 0, withdrawn = 0;
    samples.forEach((s) => {
      if (s.isWithdrawn) withdrawn++;
      else if (s.status === 'processed') processed++;
      else if (s.status === 'pending') pending++;
      else if (s.status === 'blocked') blocked++;
    });
    return {
      processed, pending, blocked,
      anomalies: anomalies.length,
      withdrawn,
      driftEvents: driftEvents.length,
    };
  },
  getHandoverReport: (): HandoverReport => {
    const state = get();
    const summary = state.getSummary();
    const blockedItems: HandoverReport['blockedItems'] = [];
    const pendingItems: HandoverReport['pendingItems'] = [];

    state.anomalies.forEach((a) => {
      const station = state.stations.find((st) => st.id === a.stationId);
      const sample = state.samples.find((s) => s.id === a.sampleId);
      const lb = state.findLogbookById(a.sourceLogbookId);
      if (!station || !sample || !lb) return;
      const stationName = station.name;
      const source = { page: lb.page, line: lb.lineNumber, content: lb.content };

      if (a.evidenceStatus === 'none' || sample.status === 'blocked') {
        blockedItems.push({
          id: a.id, station: stationName, timestamp: sample.timestamp,
          description: a.description, blocker: a.nextAction || '待处理',
          logbookSource: source,
        });
      } else if (a.evidenceStatus === 'partial') {
        const missing: string[] = [];
        if (a.id === 'an-001') missing.push('CTD原始剖面数据文件');
        if (a.id === 'an-004') missing.push('化学滴定氧样瓶标签照片');
        pendingItems.push({
          id: a.id, station: stationName, description: a.description,
          missingEvidence: missing.length > 0 ? missing : ['未说明缺失项'],
          logbookSource: source,
        });
      }
    });

    const driftItems = state.driftEvents.map((d) => ({
      id: d.id, sensorType: d.sensorType,
      startTimestamp: d.startTimestamp, endTimestamp: d.endTimestamp,
      impact: d.impact, rootCause: d.rootCause, corrected: d.corrected,
    }));

    return {
      generatedAt: new Date().toISOString(),
      shift: '早班 06:00-14:00 / 老何',
      summary: {
        processed: summary.processed,
        pendingEvidence: summary.pending,
        blocked: summary.blocked,
        anomalies: summary.anomalies,
        withdrawn: summary.withdrawn,
        driftEvents: summary.driftEvents,
      },
      blockedItems, pendingItems, driftItems,
    };
  },
  findLogbookById: (id) => logbookEntries.find((l) => l.id === id),
  findAnomaliesByStation: (stationId) => anomalies.filter((a) => a.stationId === stationId),
  findDriftsByStation: (stationId) => driftEvents.filter((d) => d.affectedStationIds.includes(stationId)),
}));
