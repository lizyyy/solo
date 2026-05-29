import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Prop, BorrowRecord, DamageRecord, AnomalyItem, SceneSchedule, BorrowStatus, EntryType } from '@/types';
import { sampleProps, sampleBorrowRecords, sampleDamageRecords, sampleAnomalies, sampleSceneSchedule } from '@/data/sample';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PropStore {
  props: Prop[];
  borrowRecords: BorrowRecord[];
  damageRecords: DamageRecord[];
  anomalies: AnomalyItem[];
  sceneSchedule: SceneSchedule[];

  loadSampleData: () => void;
  clearAllData: () => void;

  addProp: (p: Omit<Prop, 'id'>) => string;
  updateProp: (id: string, p: Partial<Prop>) => void;

  createBorrowRecord: (record: Omit<BorrowRecord, 'id' | 'status' | 'entryType' | 'originalBorrowTime' | 'originalReturnTime' | 'isSupplemented' | 'isWithdrawn'> & { entryType: EntryType }) => { success: boolean; duplicateIds: string[]; recordId: string };
  registerReturn: (recordId: string, actualReturnTime: string) => { isLate: boolean; anomalyId: string };
  withdrawRecord: (recordId: string) => void;
  supplementRecord: (recordId: string, updates: Partial<BorrowRecord>) => void;
  resolvePendingReview: (recordId: string, newStatus: BorrowStatus) => void;

  addDamageRecord: (record: Omit<DamageRecord, 'id' | 'confirmed' | 'confirmedBy' | 'confirmedAt'>) => void;
  confirmDamage: (damageId: string, confirmedBy: string) => void;

  resolveAnomaly: (anomalyId: string) => void;

  getPropById: (id: string) => Prop | undefined;
  getBorrowRecordsByPropId: (propId: string) => BorrowRecord[];
  getDamageRecordsByBorrowId: (borrowRecordId: string) => DamageRecord[];
  getActiveBorrowsByPropId: (propId: string) => BorrowRecord[];
  getScenePerformanceTime: (sceneNumber: string) => string | undefined;
}

export const usePropStore = create<PropStore>()(
  persist(
    (set, get) => ({
      props: [],
      borrowRecords: [],
      damageRecords: [],
      anomalies: [],
      sceneSchedule: [],

      loadSampleData: () => {
        set({
          props: [...sampleProps],
          borrowRecords: [...sampleBorrowRecords],
          damageRecords: [...sampleDamageRecords],
          anomalies: [...sampleAnomalies],
          sceneSchedule: [...sampleSceneSchedule],
        });
      },

      clearAllData: () => {
        set({ props: [], borrowRecords: [], damageRecords: [], anomalies: [], sceneSchedule: [] });
      },

      addProp: (p) => {
        const id = `prop-${uid()}`;
        set((s) => ({ props: [...s.props, { ...p, id }] }));
        return id;
      },

      updateProp: (id, p) => {
        set((s) => ({ props: s.props.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
      },

      createBorrowRecord: (record) => {
        const activeBorrows = get().getActiveBorrowsByPropId(record.propId);
        const duplicateIds = activeBorrows.map((b) => b.id);
        const id = `br-${uid()}`;

        let status: BorrowStatus = 'borrowed';
        const newAnomalies: AnomalyItem[] = [];

        if (duplicateIds.length > 0) {
          status = 'pending_review';
          newAnomalies.push({
            id: `anom-${uid()}`,
            type: 'duplicate_borrow',
            borrowRecordId: id,
            propId: record.propId,
            message: `道具 ${get().getPropById(record.propId)?.name || record.propId} 已有活跃借出记录（${duplicateIds.join(', ')}），疑似重复借出`,
            resolved: false,
            createdAt: new Date().toISOString(),
          });
          newAnomalies.push({
            id: `anom-${uid()}`,
            type: 'pending_review',
            borrowRecordId: id,
            propId: record.propId,
            message: `重复借出需人工复核`,
            resolved: false,
            createdAt: new Date().toISOString(),
          });
        }

        const newRecord: BorrowRecord = {
          ...record,
          id,
          status,
          originalBorrowTime: record.entryType === 'supplement' ? record.borrowTime : '',
          originalReturnTime: record.entryType === 'supplement' ? record.expectedReturnTime : '',
          isSupplemented: record.entryType === 'supplement',
          isWithdrawn: false,
        };

        set((s) => ({
          borrowRecords: [...s.borrowRecords, newRecord],
          anomalies: [...s.anomalies, ...newAnomalies],
        }));

        return { success: duplicateIds.length === 0, duplicateIds, recordId: id };
      },

      registerReturn: (recordId, actualReturnTime) => {
        const record = get().borrowRecords.find((r) => r.id === recordId);
        if (!record) return { isLate: false, anomalyId: '' };

        let isLate = false;
        const anomalyId = `anom-${uid()}`;
        const newAnomalies: AnomalyItem[] = [];

        const perfTime = get().getScenePerformanceTime(record.sceneNumber);

        if (actualReturnTime > record.expectedReturnTime) {
          isLate = true;
          const propName = get().getPropById(record.propId)?.name || record.propId;
          newAnomalies.push({
            id: anomalyId,
            type: 'late_return',
            borrowRecordId: recordId,
            propId: record.propId,
            message: `${propName} 返库时间（${new Date(actualReturnTime).toLocaleString()}）晚于预计返库时间（${new Date(record.expectedReturnTime).toLocaleString()}）`,
            resolved: false,
            createdAt: new Date().toISOString(),
          });
        }

        if (perfTime && actualReturnTime > perfTime) {
          isLate = true;
          const propName = get().getPropById(record.propId)?.name || record.propId;
          const existingLate = newAnomalies.find((a) => a.id === anomalyId);
          if (!existingLate) {
            newAnomalies.push({
              id: anomalyId,
              type: 'late_return',
              borrowRecordId: recordId,
              propId: record.propId,
              message: `${propName} 返库时间晚于演出时间（${new Date(perfTime).toLocaleString()}）`,
              resolved: false,
              createdAt: new Date().toISOString(),
            });
          }
        }

        const newStatus: BorrowStatus = isLate ? 'pending_review' : 'returned';

        set((s) => ({
          borrowRecords: s.borrowRecords.map((r) =>
            r.id === recordId ? { ...r, actualReturnTime, status: newStatus } : r
          ),
          anomalies: [...s.anomalies, ...newAnomalies],
        }));

        return { isLate, anomalyId };
      },

      withdrawRecord: (recordId) => {
        set((s) => ({
          borrowRecords: s.borrowRecords.map((r) =>
            r.id === recordId ? { ...r, isWithdrawn: true, entryType: 'withdrawn' as EntryType, status: 'returned' as BorrowStatus } : r
          ),
        }));
      },

      supplementRecord: (recordId, updates) => {
        const record = get().borrowRecords.find((r) => r.id === recordId);
        if (!record) return;

        const hasConflict = updates.borrowTime && record.borrowTime !== updates.borrowTime && record.originalBorrowTime === '';

        set((s) => ({
          borrowRecords: s.borrowRecords.map((r) => {
            if (r.id !== recordId) return r;
            const updated = { ...r, ...updates, isSupplemented: true, entryType: 'supplement' as EntryType };
            if (updates.borrowTime && r.originalBorrowTime === '') {
              updated.originalBorrowTime = r.borrowTime;
            }
            if (updates.expectedReturnTime && r.originalReturnTime === '') {
              updated.originalReturnTime = r.expectedReturnTime;
            }
            return updated;
          }),
          anomalies: hasConflict
            ? [
                ...s.anomalies,
                {
                  id: `anom-${uid()}`,
                  type: 'pending_review' as const,
                  borrowRecordId: recordId,
                  propId: record.propId,
                  message: `补录时间与原始记录冲突，需人工复核`,
                  resolved: false,
                  createdAt: new Date().toISOString(),
                },
              ]
            : s.anomalies,
        }));
      },

      resolvePendingReview: (recordId, newStatus) => {
        set((s) => ({
          borrowRecords: s.borrowRecords.map((r) =>
            r.id === recordId ? { ...r, status: newStatus } : r
          ),
          anomalies: s.anomalies.map((a) =>
            a.borrowRecordId === recordId && a.type === 'pending_review' ? { ...a, resolved: true } : a
          ),
        }));
      },

      addDamageRecord: (record) => {
        const id = `dmg-${uid()}`;
        const newDamage: DamageRecord = { ...record, id, confirmed: false, confirmedBy: '', confirmedAt: '' };
        const propName = get().getPropById(
          get().borrowRecords.find((r) => r.id === record.borrowRecordId)?.propId || ''
        )?.name || '';

        set((s) => ({
          damageRecords: [...s.damageRecords, newDamage],
          anomalies: [
            ...s.anomalies,
            {
              id: `anom-${uid()}`,
              type: 'unconfirmed_damage' as const,
              borrowRecordId: record.borrowRecordId,
              propId: get().borrowRecords.find((r) => r.id === record.borrowRecordId)?.propId || '',
              message: `${propName} 损伤"${record.description}"尚未确认`,
              resolved: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      confirmDamage: (damageId, confirmedBy) => {
        const now = new Date().toISOString();
        set((s) => ({
          damageRecords: s.damageRecords.map((d) =>
            d.id === damageId ? { ...d, confirmed: true, confirmedBy, confirmedAt: now } : d
          ),
          anomalies: s.anomalies.map((a) => {
            const dmg = s.damageRecords.find((d) => d.id === damageId);
            if (dmg && a.borrowRecordId === dmg.borrowRecordId && a.type === 'unconfirmed_damage') {
              return { ...a, resolved: true };
            }
            return a;
          }),
        }));
      },

      resolveAnomaly: (anomalyId) => {
        set((s) => ({
          anomalies: s.anomalies.map((a) => (a.id === anomalyId ? { ...a, resolved: true } : a)),
        }));
      },

      getPropById: (id) => get().props.find((p) => p.id === id),

      getBorrowRecordsByPropId: (propId) => get().borrowRecords.filter((r) => r.propId === propId),

      getDamageRecordsByBorrowId: (borrowRecordId) => get().damageRecords.filter((d) => d.borrowRecordId === borrowRecordId),

      getActiveBorrowsByPropId: (propId) =>
        get().borrowRecords.filter((r) => r.propId === propId && (r.status === 'borrowed' || r.status === 'on_stage') && !r.isWithdrawn),

      getScenePerformanceTime: (sceneNumber) => get().sceneSchedule.find((s) => s.sceneNumber === sceneNumber)?.performanceTime,
    }),
    {
      name: 'theater-prop-storage',
    }
  )
);
