import { create } from 'zustand';
import type {
  AbnormalAlert,
  AlertStatus,
  FilterState,
  MedicationChange,
  Note,
  Severity,
  TimelineEntry,
  VaccinePhoto,
} from '../types';
import { DEFAULT_FILTER } from '../types';
import { getInitialData } from '../data/mockData';

const LS_KEY_FILTER = 'pwa:filter:v1';
const LS_KEY_ALERTS = 'pwa:alerts:v1';
const LS_KEY_USER = 'pwa:currentUser:v1';

interface StoreState {
  alerts: AbnormalAlert[];
  filter: FilterState;
  selectedAlertId: string | null;
  currentUser: string;
}

interface StoreActions {
  setFilter: (patch: Partial<FilterState>) => void;
  resetFilter: () => void;
  hydrateFromStorage: () => void;
  syncFilterToUrl: () => void;
  loadFilterFromUrl: () => void;
  selectAlert: (id: string | null) => void;
  markRead: (id: string) => void;
  updateStatus: (id: string, status: AlertStatus) => void;
  addNote: (id: string, content: string) => void;
  addVaccinePhotos: (id: string, photos: Array<{ url: string; remark?: string }>) => void;
  changeMedication: (
    id: string,
    change: {
      drugName: string;
      oldDosage: string;
      newDosage: string;
      guidanceNote: string;
    },
  ) => void;
  supplementMaterial: (id: string, content: string) => void;
  rerunJudgment: (id: string) => { ok: boolean; gaps: string[] };
  setCurrentUser: (name: string) => void;
  exportCsvRows: () => AbnormalAlert[];
  validateHistoryContinuity: (alert: AbnormalAlert) => { ok: boolean; gaps: string[] };
  resetAllData: () => void;
}

export type AppStore = StoreState & StoreActions;

const uid = () => Math.random().toString(36).slice(2, 10);
const nowISO = () => new Date().toISOString();
const snapshotOf = (a: AbnormalAlert) =>
  `判断快照: ${a.pet?.name ?? ''} 减重${Math.abs(a.weightLossPct)}% 等级:${a.severity} v${a.judgmentVersion} @${new Date()
    .toISOString()
    .slice(0, 10)}`;

function loadAlertsInit(): AbnormalAlert[] {
  try {
    const raw = localStorage.getItem(LS_KEY_ALERTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getInitialData();
}

function loadFilterInit(): FilterState {
  try {
    const raw = localStorage.getItem(LS_KEY_FILTER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_FILTER };
}

function saveAlerts(alerts: AbnormalAlert[]) {
  localStorage.setItem(LS_KEY_ALERTS, JSON.stringify(alerts));
}

function saveFilter(filter: FilterState) {
  localStorage.setItem(LS_KEY_FILTER, JSON.stringify(filter));
}

function appendTimeline(
  alert: AbnormalAlert,
  entry: Omit<TimelineEntry, 'id' | 'createdAt' | 'alertId' | 'judgmentSnapshot'> &
    Partial<Pick<TimelineEntry, 'photos' | 'medication'>>,
): AbnormalAlert {
  const newEntry: TimelineEntry = {
    id: 'tl-' + uid(),
    alertId: alert.id,
    createdAt: nowISO(),
    judgmentSnapshot: snapshotOf(alert),
    ...entry,
  } as TimelineEntry;
  return {
    ...alert,
    timeline: [...(alert.timeline ?? []), newEntry],
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  alerts: loadAlertsInit(),
  filter: loadFilterInit(),
  selectedAlertId: null,
  currentUser: localStorage.getItem(LS_KEY_USER) ?? '阿宁',

  setFilter: (patch) =>
    set((s) => {
      const filter = { ...s.filter, ...patch };
      saveFilter(filter);
      return { filter };
    }),

  resetFilter: () =>
    set(() => {
      saveFilter(DEFAULT_FILTER);
      return { filter: { ...DEFAULT_FILTER } };
    }),

  hydrateFromStorage: () =>
    set(() => ({
      alerts: loadAlertsInit(),
      filter: loadFilterInit(),
      currentUser: localStorage.getItem(LS_KEY_USER) ?? '阿宁',
    })),

  syncFilterToUrl: () => {
    const filter = get().filter;
    const params = new URLSearchParams();
    if (filter.keyword) params.set('q', filter.keyword);
    if (filter.dateFrom) params.set('from', filter.dateFrom);
    if (filter.dateTo) params.set('to', filter.dateTo);
    if (filter.severities.length) params.set('sev', filter.severities.join(','));
    if (filter.statuses.length) params.set('st', filter.statuses.join(','));
    if (filter.assignedTo) params.set('as', filter.assignedTo);
    const q = params.toString();
    const url = q ? `${location.pathname}?${q}` : location.pathname;
    window.history.replaceState({}, '', url);
  },

  loadFilterFromUrl: () => {
    const params = new URLSearchParams(location.search);
    const next: Partial<FilterState> = {};
    if (params.has('q')) next.keyword = params.get('q')!;
    if (params.has('from')) next.dateFrom = params.get('from')!;
    if (params.has('to')) next.dateTo = params.get('to')!;
    if (params.has('sev'))
      next.severities = (params.get('sev')!.split(',') as Severity[]).filter(Boolean);
    if (params.has('st'))
      next.statuses = (params.get('st')!.split(',') as AlertStatus[]).filter(Boolean);
    if (params.has('as')) next.assignedTo = params.get('as')!;
    if (Object.keys(next).length) {
      get().setFilter(next);
    }
  },

  selectAlert: (id) => set({ selectedAlertId: id }),

  markRead: (id) =>
    set((s) => {
      const alerts = s.alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
      saveAlerts(alerts);
      return { alerts };
    }),

  updateStatus: (id, status) =>
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        const next = appendTimeline(a, {
          entryType: 'status_updated',
          operator: user,
          content: `处理状态：${a.currentStatus} → ${status}。`,
        });
        return { ...next, currentStatus: status };
      });
      saveAlerts(alerts);
      return { alerts };
    }),

  addNote: (id, content) =>
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        const note: Note = {
          id: 'n-' + uid(),
          alertId: id,
          createdAt: nowISO(),
          author: user,
          content,
          isManual: true,
        };
        const withNote = { ...a, notes: [...(a.notes ?? []), note] };
        return appendTimeline(withNote, {
          entryType: 'note_added',
          operator: user,
          content: `备注：${content.length > 40 ? content.slice(0, 40) + '…' : content}`,
        });
      });
      saveAlerts(alerts);
      return { alerts };
    }),

  addVaccinePhotos: (id, photos) =>
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        const existingBatches =
          a.timeline
            ?.flatMap((t) => t.photos ?? [])
            .reduce((m, p) => Math.max(m, p.batchNumber), 0) ?? 0;
        const batch = existingBatches + 1;
        const uploadTime = nowISO();
        const entryId = 'tl-' + uid();
        const builtPhotos: VaccinePhoto[] = photos.map((p, idx) => ({
          id: 'vp-' + uid() + idx,
          timelineEntryId: entryId,
          batchNumber: batch,
          url: p.url,
          uploadTime,
          remark: p.remark,
        }));
        const next = {
          ...a,
          timeline: [
            ...(a.timeline ?? []),
            {
              id: entryId,
              alertId: a.id,
              createdAt: uploadTime,
              entryType: 'vaccine_photo_uploaded' as const,
              operator: user,
              content: `上传疫苗本照片（第${batch}批）：共 ${photos.length} 张。`,
              judgmentSnapshot: snapshotOf(a),
              photos: builtPhotos,
            },
          ],
        };
        return next;
      });
      saveAlerts(alerts);
      return { alerts };
    }),

  changeMedication: (id, change) =>
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        const entryId = 'tl-' + uid();
        const med: MedicationChange = {
          id: 'med-' + uid(),
          timelineEntryId: entryId,
          ...change,
        };
        const next = appendTimeline(a, {
          entryType: 'medication_changed',
          operator: user,
          content: `${change.drugName}：${change.oldDosage} → ${change.newDosage}。`,
        });
        const tl = next.timeline!;
        tl[tl.length - 1] = { ...tl[tl.length - 1], id: entryId, medication: med };
        return {
          ...next,
          currentMedication: {
            drugName: change.drugName,
            dosage: change.newDosage,
            startDate: new Date().toISOString().slice(0, 10),
          },
          timeline: tl,
        };
      });
      saveAlerts(alerts);
      return { alerts };
    }),

  supplementMaterial: (id, content) =>
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        return appendTimeline(a, {
          entryType: 'material_supplemented',
          operator: user,
          content,
        });
      });
      saveAlerts(alerts);
      return { alerts };
    }),

  validateHistoryContinuity: (alert) => {
    const tl = alert.timeline ?? [];
    const gaps: string[] = [];
    // 时间单调递增
    for (let i = 1; i < tl.length; i++) {
      if (new Date(tl[i].createdAt) < new Date(tl[i - 1].createdAt)) {
        gaps.push(`时间线倒序: #${i + 1} ${tl[i].entryType} 早于前序条目`);
      }
    }
    // judgment_rerun 版本号连续
    const reruns = tl
      .map((t, idx) => ({ t, idx }))
      .filter((x) => x.t.entryType === 'judgment_rerun' || x.t.entryType === 'judgment_created');
    const versions = reruns.map((r) => {
      const m = r.t.content.match(/v(\d+)(?:→v(\d+))?/);
      if (!m) return null;
      return m[2] ? [Number(m[1]), Number(m[2])] : [Number(m[1])];
    });
    if (alert.judgmentVersion < 1) gaps.push('判断版本号异常');
    return { ok: gaps.length === 0, gaps };
  },

  rerunJudgment: (id) => {
    let result = { ok: true, gaps: [] as string[] };
    set((s) => {
      const user = s.currentUser;
      const alerts = s.alerts.map((a) => {
        if (a.id !== id) return a;
        result = get().validateHistoryContinuity(a);
        const nextVersion = a.judgmentVersion + 1;
        // 模拟重跑：用最新数据重新计算。这里按最新体重差重新估计等级。
        const wr = a.weightRecords ?? [];
        let severity = a.severity;
        if (wr.length >= 2) {
          const first = wr[0].weightKg;
          const last = wr[wr.length - 1].weightKg;
          const loss = ((last - first) / first) * 100;
          const abs = Math.abs(loss);
          if (abs >= 7) severity = 'severe';
          else if (abs >= 4) severity = 'moderate';
          else severity = 'mild';
        }
        const updatedAlert: AbnormalAlert = {
          ...a,
          judgmentVersion: nextVersion,
          severity,
        };
        const passNote = result.ok
          ? `连续性校验：通过✅`
          : `连续性校验：不通过⚠️ (${result.gaps.join('；')})`;
        const snap = `判断快照: ${a.pet?.name ?? ''} 减重${Math.abs(
          a.weightLossPct,
        )}% 等级:${severity} v${nextVersion} @${new Date().toISOString().slice(0, 10)}`;
        return {
          ...updatedAlert,
          judgmentSnapshot: snap,
          timeline: [
            ...(a.timeline ?? []),
            {
              id: 'tl-' + uid(),
              alertId: a.id,
              createdAt: nowISO(),
              entryType: 'judgment_rerun' as const,
              operator: user,
              content: `【重跑判断 v${a.judgmentVersion}→v${nextVersion}】${
                severity !== a.severity ? `异常等级调整: ${a.severity} → ${severity}。` : '等级保持不变。'
              } ${passNote}`,
              judgmentSnapshot: snap,
            },
          ],
        };
      });
      saveAlerts(alerts);
      return { alerts };
    });
    return result;
  },

  setCurrentUser: (name) => {
    localStorage.setItem(LS_KEY_USER, name);
    set({ currentUser: name });
  },

  exportCsvRows: () => {
    const state = get();
    return filterAlerts(state.alerts, state.filter);
  },

  resetAllData: () => {
    localStorage.removeItem(LS_KEY_ALERTS);
    localStorage.removeItem(LS_KEY_FILTER);
    set({ alerts: getInitialData(), filter: { ...DEFAULT_FILTER } });
  },
}));

export function filterAlerts(alerts: AbnormalAlert[], f: FilterState): AbnormalAlert[] {
  return alerts.filter((a) => {
    if (f.keyword) {
      const kw = f.keyword.toLowerCase();
      const pet = a.pet;
      const hit =
        pet?.name.toLowerCase().includes(kw) ||
        pet?.ownerName.toLowerCase().includes(kw) ||
        pet?.breed.toLowerCase().includes(kw) ||
        pet?.ownerPhone.includes(kw);
      if (!hit) return false;
    }
    if (f.dateFrom && a.alertDate < f.dateFrom) return false;
    if (f.dateTo && a.alertDate > f.dateTo) return false;
    if (f.severities.length && !f.severities.includes(a.severity)) return false;
    if (f.statuses.length && !f.statuses.includes(a.currentStatus)) return false;
    if (f.assignedTo && a.assignedTo !== f.assignedTo) return false;
    return true;
  });
}
