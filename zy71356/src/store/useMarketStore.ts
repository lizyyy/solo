import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Vendor,
  Stall,
  ArrangementWithDetails,
  Conflict,
  SwapLog,
  AssignmentWithDetails,
} from '@shared/types';
import { api } from '@/lib/api';

interface MarketState {
  vendors: Vendor[];
  stalls: Stall[];
  currentArrangement: ArrangementWithDetails | null;
  arrangements: any[];
  conflicts: Conflict[];
  swapLogs: SwapLog[];
  assignments: AssignmentWithDetails[];
  loading: boolean;
  error: string | null;
  lastSaveTime: string | null;

  loadAll: () => Promise<void>;
  loadVendors: () => Promise<void>;
  loadStalls: () => Promise<void>;
  loadLatestArrangement: () => Promise<void>;
  loadArrangement: (id: string) => Promise<void>;
  loadConflicts: (id: string) => Promise<void>;

  createVendor: (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateVendor: (id: string, data: Partial<Vendor>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;

  createStall: (data: Omit<Stall, 'id'>) => Promise<void>;
  updateStall: (id: string, data: Partial<Stall>) => Promise<void>;
  deleteStall: (id: string) => Promise<void>;

  assignVendor: (stallId: string, vendorId: string, source?: string) => Promise<void>;
  removeAssignment: (stallId: string) => Promise<void>;
  swapVendors: (stallA: string, stallB: string, reason?: string) => Promise<void>;

  createArrangement: (data: Omit<ArrangementWithDetails, 'id' | 'createdAt' | 'assignments' | 'conflicts' | 'swapLogs'>) => Promise<void>;
  createNewVersion: (newVersion: string, name: string, note?: string) => Promise<void>;

  clearError: () => void;
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      vendors: [],
      stalls: [],
      currentArrangement: null,
      arrangements: [],
      conflicts: [],
      swapLogs: [],
      assignments: [],
      loading: false,
      error: null,
      lastSaveTime: null,

      loadAll: async () => {
        set({ loading: true, error: null });
        try {
          const [vendors, stalls] = await Promise.all([
            api.vendors.getAll(),
            api.stalls.getAll(),
          ]);
          set({ vendors, stalls });

          try {
            const arrangement = await api.arrangements.getLatest();
            const [conflicts, swapLogs, assignments] = await Promise.all([
              api.arrangements.getConflicts(arrangement.id),
              api.arrangements.getSwapLogs(arrangement.id),
              api.arrangements.getAssignments(arrangement.id),
            ]);
            set({
              currentArrangement: arrangement,
              conflicts,
              swapLogs,
              assignments,
              lastSaveTime: new Date().toISOString(),
            });
          } catch (e) {
            console.log('No existing arrangement found');
          }
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      loadVendors: async () => {
        set({ loading: true, error: null });
        try {
          const vendors = await api.vendors.getAll();
          set({ vendors });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      loadStalls: async () => {
        set({ loading: true, error: null });
        try {
          const stalls = await api.stalls.getAll();
          set({ stalls });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      loadLatestArrangement: async () => {
        set({ loading: true, error: null });
        try {
          const arrangement = await api.arrangements.getLatest();
          const [conflicts, swapLogs, assignments] = await Promise.all([
            api.arrangements.getConflicts(arrangement.id),
            api.arrangements.getSwapLogs(arrangement.id),
            api.arrangements.getAssignments(arrangement.id),
          ]);
          set({
            currentArrangement: arrangement,
            conflicts,
            swapLogs,
            assignments,
            lastSaveTime: new Date().toISOString(),
          });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      loadArrangement: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const arrangement = await api.arrangements.getById(id);
          const [conflicts, swapLogs, assignments] = await Promise.all([
            api.arrangements.getConflicts(id),
            api.arrangements.getSwapLogs(id),
            api.arrangements.getAssignments(id),
          ]);
          set({
            currentArrangement: arrangement,
            conflicts,
            swapLogs,
            assignments,
            lastSaveTime: new Date().toISOString(),
          });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      loadConflicts: async (id: string) => {
        try {
          const conflicts = await api.arrangements.getConflicts(id);
          set({ conflicts });
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      createVendor: async (data) => {
        set({ loading: true, error: null });
        try {
          await api.vendors.create(data);
          await get().loadVendors();
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      updateVendor: async (id, data) => {
        set({ loading: true, error: null });
        try {
          await api.vendors.update(id, data);
          await get().loadVendors();
          if (get().currentArrangement) {
            await get().loadConflicts(get().currentArrangement!.id);
          }
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      deleteVendor: async (id) => {
        set({ loading: true, error: null });
        try {
          await api.vendors.delete(id);
          await get().loadVendors();
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      createStall: async (data) => {
        set({ loading: true, error: null });
        try {
          await api.stalls.create(data);
          await get().loadStalls();
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      updateStall: async (id, data) => {
        set({ loading: true, error: null });
        try {
          await api.stalls.update(id, data);
          await get().loadStalls();
          if (get().currentArrangement) {
            await get().loadConflicts(get().currentArrangement!.id);
          }
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      deleteStall: async (id) => {
        set({ loading: true, error: null });
        try {
          await api.stalls.delete(id);
          await get().loadStalls();
          set({ lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      assignVendor: async (stallId, vendorId, source = '手动分配') => {
        const { currentArrangement } = get();
        if (!currentArrangement) return;

        set({ loading: true, error: null });
        try {
          await api.arrangements.assign(currentArrangement.id, stallId, vendorId, source);
          const [conflicts, assignments] = await Promise.all([
            api.arrangements.getConflicts(currentArrangement.id),
            api.arrangements.getAssignments(currentArrangement.id),
          ]);
          set({ conflicts, assignments, lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      removeAssignment: async (stallId) => {
        const { currentArrangement } = get();
        if (!currentArrangement) return;

        set({ loading: true, error: null });
        try {
          await api.arrangements.removeAssignment(currentArrangement.id, stallId);
          const [conflicts, assignments] = await Promise.all([
            api.arrangements.getConflicts(currentArrangement.id),
            api.arrangements.getAssignments(currentArrangement.id),
          ]);
          set({ conflicts, assignments, lastSaveTime: new Date().toISOString() });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      swapVendors: async (stallA, stallB, reason) => {
        const { currentArrangement } = get();
        if (!currentArrangement) return;

        set({ loading: true, error: null });
        try {
          await api.arrangements.swap(
            currentArrangement.id,
            stallA,
            stallB,
            reason,
            '系统管理员'
          );
          const [conflicts, swapLogs, assignments] = await Promise.all([
            api.arrangements.getConflicts(currentArrangement.id),
            api.arrangements.getSwapLogs(currentArrangement.id),
            api.arrangements.getAssignments(currentArrangement.id),
          ]);
          set({
            conflicts,
            swapLogs,
            assignments,
            lastSaveTime: new Date().toISOString(),
          });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      createArrangement: async (data) => {
        set({ loading: true, error: null });
        try {
          const arrangement = await api.arrangements.create(data);
          await get().loadArrangement(arrangement.id);
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      createNewVersion: async (newVersion, name, note) => {
        const { currentArrangement } = get();
        if (!currentArrangement) return;

        set({ loading: true, error: null });
        try {
          const newArrangement = await api.arrangements.createVersion(
            currentArrangement.id,
            newVersion,
            name,
            '系统管理员',
            note
          );
          set({
            currentArrangement: newArrangement,
            conflicts: newArrangement.conflicts,
            swapLogs: newArrangement.swapLogs,
            assignments: [],
            lastSaveTime: new Date().toISOString(),
          });
        } catch (error: any) {
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'market-storage',
      partialize: (state) => ({
        vendors: state.vendors,
        stalls: state.stalls,
        currentArrangement: state.currentArrangement,
        conflicts: state.conflicts,
        swapLogs: state.swapLogs,
        assignments: state.assignments,
        lastSaveTime: state.lastSaveTime,
      }),
    }
  )
);
