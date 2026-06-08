import { create } from 'zustand';
import type { DogRecord, SnapshotData, Supplement, VaccineRecord, Conclusion, WeightUnit, Operator, HistoryEntry } from '@/types';
import { mockDogRecords } from '@/data/mockData';
import { cloneSnapshot, formatDate } from '@/utils/dataUtils';

interface DraftForm {
  dogName: string;
  breed: string;
  gender: '公' | '母' | '';
  age: string;
  weight: string;
  weightUnit: WeightUnit;
  ownerName: string;
  ownerPhone: string;
  vaccines: Array<Omit<VaccineRecord, 'id'> & { _id?: string }>;
  supplements: Array<Omit<Supplement, 'id' | 'time'> & { _id?: string }>;
  conclusion: Conclusion;
}

const emptyDraft: DraftForm = {
  dogName: '', breed: '', gender: '', age: '', weight: '', weightUnit: 'kg',
  ownerName: '', ownerPhone: '',
  vaccines: [{ name: '狂犬疫苗', date: '', expireDate: '', attachmentName: '' }],
  supplements: [],
  conclusion: '待审核',
};

interface StoreState {
  records: DogRecord[];
  selectedRecordId: string | null;
  selectedVersionA: number | null;
  selectedVersionB: number | null;
  draft: DraftForm;
}

interface StoreActions {
  setSelectedRecord: (id: string | null) => void;
  setSelectedVersions: (a: number | null, b: number | null) => void;
  updateDraft: (patch: Partial<DraftForm>) => void;
  addDraftVaccine: () => void;
  removeDraftVaccine: (idx: number) => void;
  updateDraftVaccine: (idx: number, patch: Partial<VaccineRecord>) => void;
  addDraftSupplement: (content: string, operator: Operator) => void;
  submitDraft: () => DogRecord | null;
  resetDraft: () => void;
}

export const useDogStore = create<StoreState & StoreActions>((set, get) => ({
  records: mockDogRecords,
  selectedRecordId: mockDogRecords[0]?.id ?? null,
  selectedVersionA: 1,
  selectedVersionB: mockDogRecords[0]?.versionHistory.length ?? 1,
  draft: { ...emptyDraft, vaccines: [{ name: '狂犬疫苗', date: '', expireDate: '', attachmentName: '' }], supplements: [] },

  setSelectedRecord: (id) => {
    const rec = get().records.find(r => r.id === id);
    set({
      selectedRecordId: id,
      selectedVersionA: 1,
      selectedVersionB: rec?.versionHistory.length ?? 1,
    });
  },

  setSelectedVersions: (a, b) => set({ selectedVersionA: a, selectedVersionB: b }),

  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  addDraftVaccine: () => set((s) => ({
    draft: { ...s.draft, vaccines: [...s.draft.vaccines, { name: '', date: '', expireDate: '', attachmentName: '' }] },
  })),

  removeDraftVaccine: (idx) => set((s) => ({
    draft: { ...s.draft, vaccines: s.draft.vaccines.filter((_, i) => i !== idx) },
  })),

  updateDraftVaccine: (idx, patch) => set((s) => ({
    draft: {
      ...s.draft,
      vaccines: s.draft.vaccines.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    },
  })),

  addDraftSupplement: (content, operator) => {
    if (!content.trim()) return;
    set((s) => ({
      draft: {
        ...s.draft,
        supplements: [
          ...s.draft.supplements,
          { content: content.trim(), operator },
        ],
      },
    }));
  },

  resetDraft: () => set({ draft: { ...emptyDraft, vaccines: [{ name: '狂犬疫苗', date: '', expireDate: '', attachmentName: '' }], supplements: [] } }),

  submitDraft: () => {
    const { draft, records } = get();
    if (!draft.dogName.trim() || !draft.breed.trim()) return null;

    const weightNum = parseFloat(draft.weight) || 0;
    const vaccines: VaccineRecord[] = draft.vaccines
      .filter(v => v.name.trim())
      .map((v, i) => ({
        id: `nv-${Date.now()}-${i}`,
        name: v.name, date: v.date, expireDate: v.expireDate,
        attachmentUrl: v.attachmentUrl, attachmentName: v.attachmentName,
        attachmentNote: v.attachmentNote, attachmentArrivedLate: v.attachmentArrivedLate,
      }));

    const supplements: Supplement[] = draft.supplements
      .filter(s => s.content.trim())
      .map((s, i) => ({
        id: `ns-${Date.now()}-${i}`,
        time: formatDate(new Date()),
        content: s.content, operator: s.operator,
      }));

    const current: SnapshotData = {
      dogName: draft.dogName.trim(),
      breed: draft.breed.trim(),
      gender: (draft.gender || '公') as '公' | '母',
      age: draft.age,
      weight: weightNum,
      weightUnit: draft.weightUnit,
      ownerName: draft.ownerName,
      ownerPhone: draft.ownerPhone,
      vaccines,
      supplements,
      conclusion: draft.conclusion,
    };

    const nowStr = formatDate(new Date());
    const hasAnomaly = !draft.weightUnit || vaccines.some(v => v.attachmentArrivedLate);

    const entry: HistoryEntry = {
      version: 1,
      timestamp: nowStr,
      operator: '小温',
      snapshot: cloneSnapshot(current),
      remark: `新建记录，疫苗 ${vaccines.length} 针，补录备注 ${supplements.length} 条。`,
      anomaly: hasAnomaly ? (vaccines.some(v => v.attachmentArrivedLate) ? 'late_attachment' : 'weight_unit_mixed') : undefined,
    };

    const newRec: DogRecord = {
      id: `dog-new-${Date.now()}`,
      statusTag: hasAnomaly ? 'anomaly' : supplements.length > 0 ? 'supplement' : 'normal',
      statusLabel: hasAnomaly ? '异常标注' : supplements.length > 0 ? '含补录' : '正常记录',
      caseType: supplements.length > 0 ? '包含主人追加补录备注' : '首次登记',
      createdAt: nowStr,
      currentConclusion: current.conclusion,
      current, vaccines, supplements,
      versionHistory: [entry],
    };

    const nextRecords = [newRec, ...records];
    set({
      records: nextRecords,
      selectedRecordId: newRec.id,
      selectedVersionA: 1,
      selectedVersionB: 1,
      draft: { ...emptyDraft, vaccines: [{ name: '狂犬疫苗', date: '', expireDate: '', attachmentName: '' }], supplements: [] },
    });
    return newRec;
  },
}));
