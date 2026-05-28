import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Redemption, ConsumptionRecord, Identification, DisputeNote, Batch, OperationLog } from '../types';
import { mockRedemptions, mockConsumptionRecords, mockIdentifications, mockDisputeNotes, mockBatches, mockOperationLogs } from '../data/mockData';

interface AppState {
  redemptions: Redemption[];
  consumptionRecords: ConsumptionRecord[];
  identifications: Identification[];
  disputeNotes: DisputeNote[];
  batches: Batch[];
  operationLogs: OperationLog[];
  currentUser: string;
  isInitialized: boolean;

  setInitialized: () => void;
  addRedemption: (redemption: Redemption) => void;
  updateRedemption: (id: string, data: Partial<Redemption>) => void;
  deleteRedemption: (id: string) => void;
  addConsumptionRecord: (record: ConsumptionRecord) => void;
  updateConsumptionRecord: (id: string, data: Partial<ConsumptionRecord>) => void;
  deleteConsumptionRecord: (id: string) => void;
  addIdentification: (identification: Identification) => void;
  addDisputeNote: (note: DisputeNote) => void;
  updateDisputeNote: (id: string, data: Partial<DisputeNote>) => void;
  addBatch: (batch: Batch) => void;
  updateBatch: (id: string, data: Partial<Batch>) => void;
  addOperationLog: (log: OperationLog) => void;
  getRedemptionById: (id: string) => Redemption | undefined;
  getConsumptionRecordsByRedemptionId: (redemptionId: string) => ConsumptionRecord[];
  getIdentificationById: (id: string) => Identification | undefined;
  getDisputeNotesByRedemptionId: (redemptionId: string) => DisputeNote[];
  getBatchById: (id: string) => Batch | undefined;
  getOperationLogsByRedemptionId: (redemptionId: string) => OperationLog[];
  resetToMockData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      redemptions: [],
      consumptionRecords: [],
      identifications: [],
      disputeNotes: [],
      batches: [],
      operationLogs: [],
      currentUser: '兑付专员A',
      isInitialized: false,

      setInitialized: () => set({ isInitialized: true }),

      addRedemption: (redemption) => set((state) => ({
        redemptions: [...state.redemptions, redemption]
      })),

      updateRedemption: (id, data) => set((state) => ({
        redemptions: state.redemptions.map(r =>
          r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) } : r
        )
      })),

      deleteRedemption: (id) => set((state) => ({
        redemptions: state.redemptions.filter(r => r.id !== id)
      })),

      addConsumptionRecord: (record) => set((state) => ({
        consumptionRecords: [...state.consumptionRecords, record]
      })),

      updateConsumptionRecord: (id, data) => set((state) => ({
        consumptionRecords: state.consumptionRecords.map(r =>
          r.id === id ? { ...r, ...data } : r
        )
      })),

      deleteConsumptionRecord: (id) => set((state) => ({
        consumptionRecords: state.consumptionRecords.filter(r => r.id !== id)
      })),

      addIdentification: (identification) => set((state) => ({
        identifications: [...state.identifications, identification]
      })),

      addDisputeNote: (note) => set((state) => ({
        disputeNotes: [...state.disputeNotes, note]
      })),

      updateDisputeNote: (id, data) => set((state) => ({
        disputeNotes: state.disputeNotes.map(n =>
          n.id === id ? { ...n, ...data } : n
        )
      })),

      addBatch: (batch) => set((state) => ({
        batches: [...state.batches, batch]
      })),

      updateBatch: (id, data) => set((state) => ({
        batches: state.batches.map(b =>
          b.id === id ? { ...b, ...data } : b
        )
      })),

      addOperationLog: (log) => set((state) => ({
        operationLogs: [...state.operationLogs, log]
      })),

      getRedemptionById: (id) => get().redemptions.find(r => r.id === id),

      getConsumptionRecordsByRedemptionId: (redemptionId) =>
        get().consumptionRecords.filter(r => r.redemptionId === redemptionId),

      getIdentificationById: (id) => get().identifications.find(i => i.id === id),

      getDisputeNotesByRedemptionId: (redemptionId) =>
        get().disputeNotes.filter(n => n.redemptionId === redemptionId),

      getBatchById: (id) => get().batches.find(b => b.id === id),

      getOperationLogsByRedemptionId: (redemptionId) =>
        get().operationLogs.filter(l => l.redemptionId === redemptionId),

      resetToMockData: () => set({
        redemptions: mockRedemptions,
        consumptionRecords: mockConsumptionRecords,
        identifications: mockIdentifications,
        disputeNotes: mockDisputeNotes,
        batches: mockBatches,
        operationLogs: mockOperationLogs,
        isInitialized: true
      })
    }),
    {
      name: 'prepaid-card-redemption-storage',
      version: 1,
    }
  )
);
