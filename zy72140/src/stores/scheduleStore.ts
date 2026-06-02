import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Schedule, RemarkChange } from '@/types';
import { seedSchedules } from '@/data/seedData';

interface ScheduleFilters {
  role: string;
  timeSlot: string;
  status: string;
  date: string;
  search: string;
}

interface ScheduleState {
  schedules: Schedule[];
  filters: ScheduleFilters;
  setFilter: (key: keyof ScheduleFilters, value: string) => void;
  resetFilters: () => void;
  addSchedule: (schedule: Schedule) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  updateRemark: (id: string, newRemark: string) => void;
  getFilteredSchedules: () => Schedule[];
  getScheduleById: (id: string) => Schedule | undefined;
}

const defaultFilters: ScheduleFilters = {
  role: '',
  timeSlot: '',
  status: '',
  date: '',
  search: '',
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      schedules: [],
      filters: { ...defaultFilters },
      setFilter: (key, value) =>
        set((state) => ({ filters: { ...state.filters, [key]: value } })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),
      addSchedule: (schedule) =>
        set((state) => ({ schedules: [...state.schedules, schedule] })),
      updateSchedule: (id, updates) =>
        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        })),
      updateRemark: (id, newRemark) =>
        set((state) => ({
          schedules: state.schedules.map((s) => {
            if (s.id !== id) return s;
            const change: RemarkChange = {
              from: s.remark ?? '',
              to: newRemark,
              changedAt: new Date().toISOString(),
            };
            return {
              ...s,
              remarkHistory: [...(s.remarkHistory ?? []), change],
              remark: newRemark,
              updatedAt: new Date().toISOString(),
            };
          }),
        })),
      getFilteredSchedules: () => {
        const { schedules, filters } = get();
        return schedules.filter((s) => {
          if (filters.role && s.role !== filters.role) return false;
          if (filters.timeSlot && s.timeSlot !== filters.timeSlot) return false;
          if (filters.status && s.status !== filters.status) return false;
          if (filters.date && s.date !== filters.date) return false;
          if (
            filters.search &&
            !s.volunteerName.toLowerCase().includes(filters.search.toLowerCase()) &&
            !s.role.toLowerCase().includes(filters.search.toLowerCase()) &&
            !s.remark.toLowerCase().includes(filters.search.toLowerCase())
          )
            return false;
          return true;
        });
      },
      getScheduleById: (id) => get().schedules.find((s) => s.id === id),
    }),
    {
      name: 'festival-schedules',
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<ScheduleState>) };
        if (!merged.schedules || merged.schedules.length === 0) {
          merged.schedules = seedSchedules;
        }
        return merged;
      },
    }
  )
);
