import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Registration, StatusHistory, Anomaly, RegistrationStatus, ExportRecord } from '@/types';
import { generateMockData } from '@/utils/mockData';
import { createSwapAnomaly } from '@/utils/anomalyDetector';

const generateId = () => Math.random().toString(36).substring(2, 10);

interface AppState {
  registrations: Registration[];
  statusHistories: StatusHistory[];
  anomalies: Anomaly[];
  exportRecords: ExportRecord[];
  currentOperator: string;
  initialized: boolean;

  initMockData: () => void;
  setCurrentOperator: (name: string) => void;

  addRegistration: (reg: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRegistration: (id: string, updates: Partial<Registration>, operator: string, reason: string) => void;
  changeStatus: (id: string, toStatus: RegistrationStatus, operator: string, reason: string, swapFrom?: string, swapTo?: string) => void;
  swapArtwork: (id: string, swapFrom: string, swapTo: string, reason: string, operator: string) => void;

  resolveAnomaly: (anomalyId: string, resolver: string) => void;
  batchResolveAnomalies: (anomalyIds: string[], resolver: string) => void;

  addExportRecord: (record: ExportRecord) => void;

  getRegistrationById: (id: string) => Registration | undefined;
  getHistoriesByRegistrationId: (id: string) => StatusHistory[];
  getAnomaliesByRegistrationId: (id: string) => Anomaly[];
  getUnresolvedAnomalies: () => Anomaly[];
  getAnomaliesByType: (type: string) => Anomaly[];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      registrations: [],
      statusHistories: [],
      anomalies: [],
      exportRecords: [],
      currentOperator: '策展人',
      initialized: false,

      initMockData: () => {
        if (get().initialized) return;
        const data = generateMockData();
        set({
          registrations: data.registrations,
          statusHistories: data.statusHistories,
          anomalies: data.anomalies,
          initialized: true,
        });
      },

      setCurrentOperator: (name: string) => {
        set({ currentOperator: name });
      },

      addRegistration: (reg) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newReg: Registration = {
          ...reg,
          id,
          createdAt: now,
          updatedAt: now,
        };

        const history: StatusHistory = {
          id: generateId(),
          registrationId: id,
          fromStatus: null,
          toStatus: reg.status,
          operator: get().currentOperator,
          reason: '新增报名',
          createdAt: now,
        };

        set((state) => ({
          registrations: [...state.registrations, newReg],
          statusHistories: [...state.statusHistories, history],
        }));

        return id;
      },

      updateRegistration: (id, updates, operator, reason) => {
        const now = new Date().toISOString();
        set((state) => ({
          registrations: state.registrations.map((reg) =>
            reg.id === id ? { ...reg, ...updates, updatedAt: now, source: 'correction' as const } : reg
          ),
          statusHistories: [
            ...state.statusHistories,
            {
              id: generateId(),
              registrationId: id,
              fromStatus: state.registrations.find((r) => r.id === id)?.status || null,
              toStatus: state.registrations.find((r) => r.id === id)?.status || 'pending',
              operator,
              reason,
              createdAt: now,
            },
          ],
        }));
      },

      changeStatus: (id, toStatus, operator, reason, swapFrom, swapTo) => {
        const now = new Date().toISOString();
        const reg = get().registrations.find((r) => r.id === id);
        if (!reg) return;

        const newAnomalies: Anomaly[] = [];
        if (toStatus === 'swapped' && swapFrom && swapTo) {
          newAnomalies.push(createSwapAnomaly(id, swapFrom, swapTo));
        }

        set((state) => ({
          registrations: state.registrations.map((r) =>
            r.id === id ? { ...r, status: toStatus, updatedAt: now } : r
          ),
          statusHistories: [
            ...state.statusHistories,
            {
              id: generateId(),
              registrationId: id,
              fromStatus: reg.status,
              toStatus,
              operator,
              reason,
              swapFrom,
              swapTo,
              createdAt: now,
            },
          ],
          anomalies: [...state.anomalies, ...newAnomalies],
        }));
      },

      swapArtwork: (id, swapFrom, swapTo, reason, operator) => {
        const now = new Date().toISOString();
        const reg = get().registrations.find((r) => r.id === id);
        if (!reg) return;

        const swapAnomaly = createSwapAnomaly(id, swapFrom, swapTo);

        set((state) => ({
          registrations: state.registrations.map((r) =>
            r.id === id
              ? {
                  ...r,
                  artworkName: swapTo,
                  status: 'swapped' as RegistrationStatus,
                  updatedAt: now,
                  source: 'correction' as const,
                  notes: r.notes
                    ? `${r.notes}；调换：${swapFrom}→${swapTo}`
                    : `调换：${swapFrom}→${swapTo}`,
                }
              : r
          ),
          statusHistories: [
            ...state.statusHistories,
            {
              id: generateId(),
              registrationId: id,
              fromStatus: reg.status,
              toStatus: 'swapped',
              operator,
              reason,
              swapFrom,
              swapTo,
              createdAt: now,
            },
          ],
          anomalies: [...state.anomalies, swapAnomaly],
        }));
      },

      resolveAnomaly: (anomalyId, resolver) => {
        const now = new Date().toISOString();
        set((state) => ({
          anomalies: state.anomalies.map((a) =>
            a.id === anomalyId ? { ...a, resolvedAt: now, resolver } : a
          ),
        }));
      },

      batchResolveAnomalies: (anomalyIds, resolver) => {
        const now = new Date().toISOString();
        set((state) => ({
          anomalies: state.anomalies.map((a) =>
            anomalyIds.includes(a.id) ? { ...a, resolvedAt: now, resolver } : a
          ),
        }));
      },

      addExportRecord: (record) => {
        set((state) => ({
          exportRecords: [...state.exportRecords, record],
        }));
      },

      getRegistrationById: (id) => {
        return get().registrations.find((r) => r.id === id);
      },

      getHistoriesByRegistrationId: (id) => {
        return get()
          .statusHistories.filter((h) => h.registrationId === id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      getAnomaliesByRegistrationId: (id) => {
        return get().anomalies.filter((a) => a.registrationId === id);
      },

      getUnresolvedAnomalies: () => {
        return get().anomalies.filter((a) => !a.resolvedAt);
      },

      getAnomaliesByType: (type) => {
        return get().anomalies.filter((a) => a.type === type);
      },
    }),
    {
      name: 'education-registration-storage',
    }
  )
);
