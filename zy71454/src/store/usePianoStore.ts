import { create } from 'zustand';
import { PianoStoreState, RelatedKeyItem, EvidenceRecord, KeyNote } from '../types';
import { generate88Keys, generateMockNotes, generateMockEvidence, generateMockSnapshots } from '../data/mockData';

const initialKeys = generate88Keys();

const usePianoStore = create<PianoStoreState>((set, get) => ({
  keys: initialKeys,
  selectedKey: 40,
  notes: generateMockNotes(),
  evidence: generateMockEvidence(),
  snapshots: generateMockSnapshots(initialKeys),
  filters: {
    keyRange: [1, 88] as [number, number],
    pressureRange: [40, 80] as [number, number],
    reboundRange: [60, 180] as [number, number],
    status: [],
    searchText: '',
  },
  viewMode: 'heatmap',
  showPanel: true,
  currentSnapshot: null,

  setSelectedKey: (keyNumber: number | null) => set({ selectedKey: keyNumber }),

  addNote: (keyNumber: number, content: string, author: string) => {
    const existingNotes = get().notes.filter(n => n.keyNumber === keyNumber);
    const newVersion = `v${existingNotes.length + 1}.0`;
    const newNote: KeyNote = {
      id: `note-${Date.now()}`,
      keyNumber,
      content,
      createdAt: new Date().toISOString(),
      author,
      version: newVersion,
    };
    set(state => ({ notes: [...state.notes, newNote] }));

    const evidenceRecord: Omit<EvidenceRecord, 'id' | 'timestamp'> = {
      keyNumber,
      type: 'note_change',
      beforeValue: existingNotes.length > 0 ? `${existingNotes[existingNotes.length - 1].version}: ${existingNotes[existingNotes.length - 1].content.substring(0, 30)}...` : '(无)',
      afterValue: `${newVersion}: ${content.substring(0, 30)}...`,
      operator: author,
      description: '新增调律备注',
    };
    get().addEvidence(evidenceRecord);
  },

  addEvidence: (record: Omit<EvidenceRecord, 'id' | 'timestamp'>) => {
    const newRecord: EvidenceRecord = {
      ...record,
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    set(state => ({ evidence: [...state.evidence, newRecord] }));
  },

  updateKeyPressure: (keyNumber: number, pressure: number, operator: string) => {
    const key = get().keys.find(k => k.keyNumber === keyNumber);
    if (!key) return;

    const oldPressure = key.pressure;

    set(state => ({
      keys: state.keys.map(k =>
        k.keyNumber === keyNumber
          ? { ...k, pressure, pressureCurve: k.pressureCurve.map(v => Math.round(v * pressure / oldPressure)) }
          : k
      ),
    }));

    const evidenceRecord: Omit<EvidenceRecord, 'id' | 'timestamp'> = {
      keyNumber,
      type: 'pressure_adjust',
      beforeValue: `${oldPressure}g`,
      afterValue: `${pressure}g`,
      operator,
      description: '手动调整下压力值',
    };
    get().addEvidence(evidenceRecord);
  },

  updateFilters: (filters: Partial<PianoStoreState['filters']>) => {
    set(state => ({ filters: { ...state.filters, ...filters } }));
  },

  setViewMode: (mode: 'heatmap' | 'normal' | 'rebound') => set({ viewMode: mode }),

  togglePanel: () => set(state => ({ showPanel: !state.showPanel })),

  createSnapshot: (name: string, reason: string, operator: string) => {
    const snapshot = {
      id: `snap-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      keyData: JSON.parse(JSON.stringify(get().keys)),
      reason,
      operator,
    };
    set(state => ({ snapshots: [...state.snapshots, snapshot] }));
  },

  loadSnapshot: (snapshotId: string) => {
    const snapshot = get().snapshots.find(s => s.id === snapshotId);
    if (snapshot) {
      set({ keys: JSON.parse(JSON.stringify(snapshot.keyData)), currentSnapshot: snapshotId });
    }
  },

  getFilteredKeys: () => {
    const { keys, filters } = get();
    return keys.filter(key => {
      if (key.keyNumber < filters.keyRange[0] || key.keyNumber > filters.keyRange[1]) return false;
      if (key.pressure < filters.pressureRange[0] || key.pressure > filters.pressureRange[1]) return false;
      if (key.reboundTime < filters.reboundRange[0] || key.reboundTime > filters.reboundRange[1]) return false;
      if (filters.status.length > 0 && !filters.status.includes(key.status)) return false;
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (!key.noteName.toLowerCase().includes(search) && 
            !key.keyNumber.toString().includes(search)) return false;
      }
      return true;
    });
  },

  getRelatedKeys: (keyNumber: number): RelatedKeyItem[] => {
    const { keys, notes } = get();
    const currentKey = keys.find(k => k.keyNumber === keyNumber);
    if (!currentKey) return [];

    const related: RelatedKeyItem[] = [];

    keys.forEach(key => {
      if (key.keyNumber === keyNumber) return;

      let similarity = 0;
      let reason = '';

      if (Math.abs(key.pressure - currentKey.pressure) < 5) {
        similarity += 40;
        reason = '下压力接近';
      }

      if (Math.abs(key.reboundTime - currentKey.reboundTime) < 15) {
        similarity += 30;
        reason = reason ? reason + '、回弹时间接近' : '回弹时间接近';
      }

      if (key.octave === currentKey.octave) {
        similarity += 20;
        reason = reason ? reason + '、同一八度' : '同一八度';
      }

      const keyNotes = notes.filter(n => n.keyNumber === key.keyNumber);
      const currentNotes = notes.filter(n => n.keyNumber === keyNumber);
      if (keyNotes.length > 0 && currentNotes.length > 0) {
        similarity += 10;
        reason = reason ? reason + '、均有备注' : '均有备注';
      }

      if (similarity >= 40) {
        related.push({ keyNumber: key.keyNumber, reason, similarity });
      }
    });

    return related.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  },
}));

export default usePianoStore;
