import { create } from 'zustand';
import type {
  AnomalyRecord,
  AppActions,
  AppState,
  BimNote,
  DrainageScheme,
  SchemeId,
  SchemeStatus,
  TimelineEvent,
} from '../types';
import {
  buildCanonicalTexts,
  nowIso,
  schemeStatusLabel,
  uid,
} from '../utils/helpers';
import {
  INITIAL_SCHEMES,
  SAMPLE_NOTES,
  buildInitialTimeline,
  buildNoteImportTimeline,
  detectAnomalies,
} from '../data/mockData';

const initSchemes: DrainageScheme[] = INITIAL_SCHEMES.map((s) => ({
  ...s,
  sceneAnnotation: buildCanonicalTexts({ scheme: s, eventKind: 'scene' }),
  sideNote: buildCanonicalTexts({ scheme: s, eventKind: 'side' }),
}));

const initialState: AppState = {
  schemes: initSchemes,
  notes: [],
  anomalies: [],
  timeline: buildInitialTimeline(initSchemes),
  rerunHistory: [],
  selectedSchemeId: 'A',
  activePanelTab: 'side',
  notesImported: false,
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  selectScheme: (id: SchemeId) => {
    set({ selectedSchemeId: id, highlightZoneId: undefined });
  },

  selectAnomaly: (id?: string) => {
    const { anomalies } = get();
    const sel = id ? anomalies.find((a) => a.id === id) : undefined;
    set({
      selectedAnomalyId: id,
      highlightZoneId: sel?.affectedZoneId,
      activePanelTab: id ? 'anomaly' : get().activePanelTab,
    });
  },

  setActivePanelTab: (tab) => set({ activePanelTab: tab }),

  highlightZone: (zoneId) => set({ highlightZoneId: zoneId }),

  importSampleNotes: () => {
    const s = get();
    if (s.notesImported) return;
    const schemes = s.schemes;
    const notes: BimNote[] = SAMPLE_NOTES.map((n) => ({ ...n }));
    const anomalies: AnomalyRecord[] = detectAnomalies(notes);
    const newTimeline: TimelineEvent[] = [...s.timeline];
    for (const note of notes) {
      const scheme = schemes.find((x) => x.id === note.schemeId)!;
      const evs = buildNoteImportTimeline(scheme, note, anomalies);
      newTimeline.push(...evs);
    }
    const schemesUpdated = schemes.map((sc) => {
      const noteCount = notes.filter((n) => n.schemeId === sc.id).length;
      const anomalyCount = anomalies.filter((a) => a.schemeId === sc.id).length;
      const sideNote = buildCanonicalTexts({ scheme: sc, eventKind: 'side' }) +
        (noteCount ? `\n\n已录入 ${noteCount} 条备注，其中 ${anomalyCount} 条异常已单独拎出。` : '');
      const sceneAnnotation = buildCanonicalTexts({ scheme: sc, eventKind: 'scene' }) +
        (anomalyCount ? `（异常 ${anomalyCount} 处已标红）` : '');
      return { ...sc, sideNote, sceneAnnotation };
    });
    newTimeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    set({
      notes,
      anomalies,
      timeline: newTimeline,
      schemes: schemesUpdated,
      notesImported: true,
      lastImportAt: nowIso(),
    });
  },

  rerunComparison: () => {
    const s = get();
    const runIndex = s.rerunHistory.length + 1;
    const timestamp = nowIso();
    const newTimeline = [...s.timeline];
    const stateTransitions: Record<SchemeId, { from: SchemeStatus; to: SchemeStatus }> = {
      A: { from: 'reviewing', to: 'approved' },
      B: { from: 'pending_material', to: 'construction_ready' },
      C: { from: 'draft', to: 'reviewing' },
    };
    const newSchemes = s.schemes.map((sc) => {
      const tr = stateTransitions[sc.id];
      let next = sc.status;
      if (runIndex === 1) next = tr.to;
      else if (runIndex === 2 && sc.id === 'C') next = 'approved';
      else if (runIndex === 2 && sc.id === 'A') next = 'construction_ready';
      else next = sc.status;
      newTimeline.push({
        id: uid('ev'),
        schemeId: sc.id,
        timestamp,
        eventType: 'comparison_rerun',
        title: `【重跑第${runIndex}轮】方案${sc.id}状态变更`,
        description: `重跑比选第 ${runIndex} 轮：方案${sc.id}「${sc.name}」由「${schemeStatusLabel(sc.status)}」→「${schemeStatusLabel(next)}」。\n重跑依据：${
          sc.id === 'A'
            ? '异常图层已修正、备注齐全，排水效率82%达标，项目经理确认推荐'
            : sc.id === 'B'
              ? '晚到虹吸斗附件已补齐，B2区图层命名统一，施工方已会签'
              : '附件到齐+图层规范命名完成，风险系数由6降为4，进入下一阶段'
        }`,
        fromState: schemeStatusLabel(sc.status),
        toState: schemeStatusLabel(next),
        actor: '项目经理·张总',
        tags: [sc.id, `rerun-${runIndex}`, 'status_changed'],
      });
      newTimeline.push({
        id: uid('ev'),
        schemeId: sc.id,
        timestamp,
        eventType: 'scheme_updated',
        title: `方案${sc.id}业务口径更新（重跑追加，历史未清空）`,
        description: buildCanonicalTexts({ scheme: { ...sc, status: next }, eventKind: 'side' }),
        actor: '系统（口径同步）',
        tags: [sc.id, 'canonical_sync'],
      });
      return { ...sc, status: next };
    });
    const rerunSummary = `第${runIndex}轮重跑：A ${stateTransitions.A.from}→${
      runIndex === 1 ? 'approved' : 'construction_ready'
    }，B pending_material→construction_ready，C draft→${runIndex === 1 ? 'reviewing' : 'approved'}。所有历史备注、时间线保留，仅追加本次状态变化。`;
    set({
      schemes: newSchemes,
      timeline: newTimeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      rerunHistory: [
        ...s.rerunHistory,
        { runIndex, timestamp, actor: '项目经理·张总', summary: rerunSummary },
      ],
    });
  },

  markAttachmentArrived: (noteId: string) => {
    const s = get();
    const note = s.notes.find((n) => n.id === noteId);
    if (!note || note.materialStatus !== 'late') return;
    const scheme = s.schemes.find((x) => x.id === note.schemeId)!;
    const timestamp = nowIso();
    const newNotes = s.notes.map((n) =>
      n.id === noteId ? { ...n, materialStatus: 'complete' as const } : n,
    );
    const anomToResolve = s.anomalies.find(
      (a) => a.noteId === noteId && a.type === 'attachment_late',
    );
    const newAnomalies = s.anomalies.map((a) =>
      a.id === anomToResolve?.id ? { ...a, status: 'resolved' as const } : a,
    );
    const newTimeline = [
      ...s.timeline,
      {
        id: uid('ev'),
        schemeId: note.schemeId,
        noteId,
        anomalyId: anomToResolve?.id,
        timestamp,
        eventType: 'material_arrived' as const,
        title: `方案${note.schemeId} 晚到附件已到齐`,
        description: `备注 [${note.layerName}] 附件「${note.attachmentName ?? '送审材料'}」已到齐并归档。该记录由「晚到/待补齐」变为「已到齐」，异常已关闭。`,
        fromState: '晚到/待补齐',
        toState: '已到齐',
        actor: '材料部',
        tags: [note.schemeId, 'material_arrived', 'resolved'],
      },
    ];
    if (anomToResolve) {
      newTimeline.push({
        id: uid('ev'),
        schemeId: note.schemeId,
        anomalyId: anomToResolve.id,
        timestamp,
        eventType: 'anomaly_resolved' as const,
        title: `方案${note.schemeId} 异常处理完成：附件晚到`,
        description: buildCanonicalTexts({ scheme, note, eventKind: 'timeline_note' }) +
          '｜晚到附件已到齐归档，异常关闭，不影响方案推进。',
        actor: '项目经理·张总',
        tags: [note.schemeId, 'anomaly_resolved'],
      });
    }
    set({ notes: newNotes, anomalies: newAnomalies, timeline: newTimeline });
  },

  resolveAnomaly: (anomalyId: string) => {
    const s = get();
    const anom = s.anomalies.find((a) => a.id === anomalyId);
    if (!anom) return;
    const timestamp = nowIso();
    const newAnomalies = s.anomalies.map((a) =>
      a.id === anomalyId ? { ...a, status: 'resolved' as const } : a,
    );
    const note = s.notes.find((n) => n.id === anom.noteId);
    const scheme = s.schemes.find((x) => x.id === anom.schemeId)!;
    const newTimeline = [
      ...s.timeline,
      {
        id: uid('ev'),
        schemeId: anom.schemeId,
        noteId: note?.id,
        anomalyId,
        timestamp,
        eventType: 'anomaly_resolved' as const,
        title: `方案${anom.schemeId} 异常处理完成：${anom.title}`,
        description:
          note?.layerIssue ??
          buildCanonicalTexts({ scheme, note, eventKind: 'timeline_note' }) +
            '｜图层命名已按 ROF-XXX-XX 规范修正，BIM 管理员已同步更新模型',
        fromState: '异常拎出待处理',
        toState: '已处理',
        actor: anom.responsible,
        tags: [anom.schemeId, 'resolved'],
      },
    ];
    set({ anomalies: newAnomalies, timeline: newTimeline });
  },

  filterTimelineByScheme: (id) => {
    const { timeline } = get();
    if (!id) return timeline;
    return timeline.filter((t) => t.schemeId === id || !t.schemeId);
  },

  getAnomaliesByScheme: (id) => get().anomalies.filter((a) => a.schemeId === id),

  getNotesByScheme: (id) => get().notes.filter((n) => n.schemeId === id),
}));
