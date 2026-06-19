import { create } from 'zustand';
import type { HistoryRecord, SampleStatus, StatusFilter, StudentSample, Verdict } from '../types';
import { SAMPLES } from '../data/mockData';

interface UIState {
  activeFilter: StatusFilter;
  searchKeyword: string;
  selectedSampleId: string | null;
  isDrawerOpen: boolean;
  isHistoryOpen: boolean;
  isVerdictPanelOpen: boolean;
  highlightedDraftLineId: string | null;
}

interface SampleState {
  samples: StudentSample[];
  ui: UIState;
  setActiveFilter: (f: StatusFilter) => void;
  setSearchKeyword: (kw: string) => void;
  selectSample: (id: string | null) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  openVerdictPanel: () => void;
  closeVerdictPanel: () => void;
  setHighlightedDraftLine: (id: string | null) => void;
  updateVerdict: (sampleId: string, verdict: Verdict, note: string) => void;
}

export const useSampleStore = create<SampleState>((set) => ({
  samples: SAMPLES,
  ui: {
    activeFilter: '全部',
    searchKeyword: '',
    selectedSampleId: null,
    isDrawerOpen: false,
    isHistoryOpen: false,
    isVerdictPanelOpen: false,
    highlightedDraftLineId: null,
  },

  setActiveFilter: (f) => set((s) => ({ ui: { ...s.ui, activeFilter: f } })),
  setSearchKeyword: (kw) => set((s) => ({ ui: { ...s.ui, searchKeyword: kw } })),
  selectSample: (id) => set((s) => ({ ui: { ...s.ui, selectedSampleId: id } })),

  openDrawer: (id) =>
    set((s) => ({ ui: { ...s.ui, selectedSampleId: id, isDrawerOpen: true } })),
  closeDrawer: () => set((s) => ({ ui: { ...s.ui, isDrawerOpen: false, highlightedDraftLineId: null } })),

  openHistory: () => set((s) => ({ ui: { ...s.ui, isHistoryOpen: true } })),
  closeHistory: () => set((s) => ({ ui: { ...s.ui, isHistoryOpen: false } })),

  openVerdictPanel: () => set((s) => ({ ui: { ...s.ui, isVerdictPanelOpen: true } })),
  closeVerdictPanel: () => set((s) => ({ ui: { ...s.ui, isVerdictPanelOpen: false } })),

  setHighlightedDraftLine: (id) => set((s) => ({ ui: { ...s.ui, highlightedDraftLineId: id } })),

  updateVerdict: (sampleId, verdict, note) =>
    set((state) => {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const sample = state.samples.find((s) => s.id === sampleId);
      if (!sample) return state;

      const newStatus: SampleStatus =
        verdict === '可放行' ? '可放行' : verdict === '需补材料' ? '异常' : sample.status;

      const historyRecord: HistoryRecord = {
        id: `h-${sampleId}-${Date.now()}`,
        sampleId,
        operator: '老叶',
        changedAt: now,
        beforeStatus: sample.status,
        afterStatus: newStatus,
        beforeVerdict: sample.finalVerdict,
        afterVerdict: verdict,
        note: note || (verdict === '可放行' ? '人工复核通过，予以放行。' : '需学生补充材料后重新提交。'),
      };

      return {
        samples: state.samples.map((s) =>
          s.id === sampleId
            ? {
                ...s,
                status: newStatus,
                finalVerdict: verdict,
                reviewNote: note || s.reviewNote,
                history: [...s.history, historyRecord],
              }
            : s,
        ),
      };
    }),
}));

export function selectFilteredSamples(
  samples: StudentSample[],
  activeFilter: StatusFilter,
  searchKeyword: string,
) {
  return samples.filter((s) => {
    if (activeFilter !== '全部' && s.status !== activeFilter) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      return (
        s.studentName.toLowerCase().includes(kw) ||
        s.studentId.toLowerCase().includes(kw) ||
        s.problemTitle.toLowerCase().includes(kw)
      );
    }
    return true;
  });
}

export function selectStats(samples: StudentSample[]) {
  return {
    total: samples.length,
    abnormal: samples.filter((s) => s.status === '异常').length,
    emptySet: samples.filter((s) => s.status === '空集合').length,
    duplicate: samples.filter((s) => s.status === '重复').length,
    pending: samples.filter((s) => s.status === '待确认').length,
    passed: samples.filter((s) => s.status === '可放行').length,
  };
}
