import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  PurchaseContract,
  InventoryLot,
  FuturesPosition,
  RolloverRecord,
  BasisRecord,
  ExposureConfig,
  AuditLog,
  ImportResult,
  DataType,
} from '../types';
import {
  mockContracts,
  mockLots,
  mockPositions,
  mockRollovers,
  mockBasis,
  defaultConfig,
} from '../mock/data';

interface DataState {
  contracts: PurchaseContract[];
  lots: InventoryLot[];
  positions: FuturesPosition[];
  rollovers: RolloverRecord[];
  basisRecords: BasisRecord[];
  exposureConfig: ExposureConfig;
  auditLogs: AuditLog[];
  importResults: ImportResult[];
  lastEditReason: string;

  setContracts: (contracts: PurchaseContract[]) => void;
  setLots: (lots: InventoryLot[]) => void;
  setPositions: (positions: FuturesPosition[]) => void;
  setRollovers: (rollovers: RolloverRecord[]) => void;
  setBasisRecords: (basisRecords: BasisRecord[]) => void;
  setExposureConfig: (config: ExposureConfig) => void;
  setLastEditReason: (reason: string) => void;

  updateLot: (id: string, updates: Partial<InventoryLot>, reason: string) => void;
  updatePosition: (
    id: string,
    updates: Partial<FuturesPosition>,
    reason: string
  ) => void;
  matchLotToPosition: (
    lotId: string,
    positionId: string | null,
    reason: string
  ) => void;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  addImportResult: (result: ImportResult) => void;
  resetToMock: () => void;
  clearAll: () => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      contracts: mockContracts,
      lots: mockLots,
      positions: mockPositions,
      rollovers: mockRollovers,
      basisRecords: mockBasis,
      exposureConfig: defaultConfig,
      auditLogs: [],
      importResults: [],
      lastEditReason: '',

      setContracts: (contracts) => set({ contracts }),
      setLots: (lots) => set({ lots }),
      setPositions: (positions) => set({ positions }),
      setRollovers: (rollovers) => set({ rollovers }),
      setBasisRecords: (basisRecords) => set({ basisRecords }),
      setExposureConfig: (config) =>
        set({
          exposureConfig: { ...config, updatedAt: new Date().toISOString() },
        }),
      setLastEditReason: (reason) => set({ lastEditReason: reason }),

      updateLot: (id, updates, reason) => {
        const { lots, auditLogs } = get();
        const lot = lots.find((l) => l.id === id);
        if (!lot) return;

        const newLots = lots.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        );

        Object.entries(updates).forEach(([field, value]) => {
          if (JSON.stringify(lot[field as keyof InventoryLot]) !== JSON.stringify(value)) {
            const log: AuditLog = {
              id: `audit-${Date.now()}-${Math.random()}`,
              entityType: 'lot',
              entityId: id,
              fieldName: field,
              oldValue: lot[field as keyof InventoryLot],
              newValue: value,
              reason,
              operator: '当前用户',
              timestamp: new Date().toISOString(),
            };
            set({ auditLogs: [...auditLogs, log] });
          }
        });

        set({ lots: newLots, lastEditReason: '' });
      },

      updatePosition: (id, updates, reason) => {
        const { positions, auditLogs } = get();
        const position = positions.find((p) => p.id === id);
        if (!position) return;

        const newPositions = positions.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );

        Object.entries(updates).forEach(([field, value]) => {
          if (JSON.stringify(position[field as keyof FuturesPosition]) !== JSON.stringify(value)) {
            const log: AuditLog = {
              id: `audit-${Date.now()}-${Math.random()}`,
              entityType: 'position',
              entityId: id,
              fieldName: field,
              oldValue: position[field as keyof FuturesPosition],
              newValue: value,
              reason,
              operator: '当前用户',
              timestamp: new Date().toISOString(),
            };
            set({ auditLogs: [...auditLogs, log] });
          }
        });

        set({ positions: newPositions, lastEditReason: '' });
      },

      matchLotToPosition: (lotId, positionId, reason) => {
        const { lots, positions } = get();
        const lot = lots.find((l) => l.id === lotId);
        if (!lot) return;

        let matchStatus: 'unmatched' | 'matched' | 'mismatch' = 'unmatched';
        if (positionId) {
          const position = positions.find((p) => p.id === positionId);
          if (position) {
            matchStatus = Math.abs(lot.quantity - position.quantity) <= 5 ? 'matched' : 'mismatch';
          }
        }

        get().updateLot(
          lotId,
          { matchedPositionId: positionId || undefined, matchStatus },
          reason
        );

        if (positionId) {
          get().updatePosition(positionId, { hedgedLotId: lotId }, reason);
        }
      },

      addAuditLog: (log) => {
        const { auditLogs } = get();
        set({
          auditLogs: [
            ...auditLogs,
            { ...log, id: `audit-${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() },
          ],
        });
      },

      addImportResult: (result) => {
        const { importResults } = get();
        set({ importResults: [...importResults, result] });
      },

      resetToMock: () =>
        set({
          contracts: mockContracts,
          lots: mockLots,
          positions: mockPositions,
          rollovers: mockRollovers,
          basisRecords: mockBasis,
          exposureConfig: defaultConfig,
        }),

      clearAll: () =>
        set({
          contracts: [],
          lots: [],
          positions: [],
          rollovers: [],
          basisRecords: [],
          auditLogs: [],
          importResults: [],
        }),
    }),
    {
      name: 'hedging-data-store',
    }
  )
);
