import { create } from 'zustand';
import {
  eventDatesApi,
  positionsApi,
  skillsApi,
  volunteersApi,
  schedulesApi,
  conflictsApi,
  schedulingApi,
  importExportApi,
} from '../services/api';

const useStore = create((set, get) => ({
  eventDates: [],
  positions: [],
  skills: [],
  volunteers: [],
  schedules: [],
  conflicts: [],
  conflictStats: { total: 0, errors: 0, warnings: 0 },
  selectedDate: null,
  selectedPosition: null,
  selectedVolunteer: null,
  loading: false,
  error: null,

  fetchAllData: async () => {
    set({ loading: true, error: null });
    try {
      const [
        eventDatesRes,
        positionsRes,
        skillsRes,
        volunteersRes,
        schedulesRes,
        conflictsRes,
      ] = await Promise.all([
        eventDatesApi.getAll(),
        positionsApi.getAll(),
        skillsApi.getAll(),
        volunteersApi.getAll(),
        schedulesApi.getAll(),
        conflictsApi.getAll(),
      ]);

      set({
        eventDates: eventDatesRes.data,
        positions: positionsRes.data,
        skills: skillsRes.data,
        volunteers: volunteersRes.data,
        schedules: schedulesRes.data,
        conflicts: conflictsRes.data.conflicts,
        conflictStats: conflictsRes.data.stats,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error.response?.data?.error || error.message,
      });
    }
  },

  fetchEventDates: async () => {
    try {
      const res = await eventDatesApi.getAll();
      set({ eventDates: res.data });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  fetchPositions: async () => {
    try {
      const res = await positionsApi.getAll();
      set({ positions: res.data });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  fetchSkills: async () => {
    try {
      const res = await skillsApi.getAll();
      set({ skills: res.data });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  fetchVolunteers: async () => {
    try {
      const res = await volunteersApi.getAll();
      set({ volunteers: res.data });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  fetchSchedules: async () => {
    try {
      const res = await schedulesApi.getAll();
      set({ schedules: res.data });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  fetchConflicts: async () => {
    try {
      const res = await conflictsApi.getAll();
      set({
        conflicts: res.data.conflicts,
        conflictStats: res.data.stats,
      });
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
    }
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedPosition: (position) => set({ selectedPosition: position }),
  setSelectedVolunteer: (volunteer) => set({ selectedVolunteer: volunteer }),

  addEventDate: async (data) => {
    try {
      const res = await eventDatesApi.create(data);
      set((state) => ({
        eventDates: [...state.eventDates, res.data],
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  updateEventDate: async (id, data) => {
    try {
      const res = await eventDatesApi.update(id, data);
      set((state) => ({
        eventDates: state.eventDates.map((d) =>
          d.id === id ? res.data : d
        ),
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  deleteEventDate: async (id) => {
    try {
      await eventDatesApi.delete(id);
      set((state) => ({
        eventDates: state.eventDates.filter((d) => d.id !== id),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  addPosition: async (data) => {
    try {
      const res = await positionsApi.create(data);
      set((state) => ({
        positions: [...state.positions, res.data],
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  updatePosition: async (id, data) => {
    try {
      const res = await positionsApi.update(id, data);
      set((state) => ({
        positions: state.positions.map((p) =>
          p.id === id ? res.data : p
        ),
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  deletePosition: async (id) => {
    try {
      await positionsApi.delete(id);
      set((state) => ({
        positions: state.positions.filter((p) => p.id !== id),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  addSkill: async (data) => {
    try {
      const res = await skillsApi.create(data);
      set((state) => ({
        skills: [...state.skills, res.data],
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  deleteSkill: async (id) => {
    try {
      await skillsApi.delete(id);
      set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  addVolunteer: async (data) => {
    try {
      const res = await volunteersApi.create(data);
      set((state) => ({
        volunteers: [...state.volunteers, res.data],
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  updateVolunteer: async (id, data) => {
    try {
      const res = await volunteersApi.update(id, data);
      set((state) => ({
        volunteers: state.volunteers.map((v) =>
          v.id === id ? res.data : v
        ),
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  deleteVolunteer: async (id) => {
    try {
      await volunteersApi.delete(id);
      set((state) => ({
        volunteers: state.volunteers.filter((v) => v.id !== id),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  addSchedule: async (data) => {
    try {
      const res = await schedulesApi.create(data);
      set((state) => ({
        schedules: [...state.schedules, res.data],
      }));
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  deleteSchedule: async (id) => {
    try {
      await schedulesApi.delete(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  generateSchedule: async (clearExisting = false) => {
    set({ loading: true });
    try {
      const res = await schedulingApi.generate(clearExisting);
      const schedulesRes = await schedulesApi.getAll();
      const conflictsRes = await conflictsApi.getAll();
      set({
        schedules: schedulesRes.data,
        conflicts: conflictsRes.data.conflicts,
        conflictStats: conflictsRes.data.stats,
        loading: false,
      });
      return res.data;
    } catch (error) {
      set({
        loading: false,
        error: error.response?.data?.error || error.message,
      });
      throw error;
    }
  },

  importVolunteers: async (file) => {
    set({ loading: true });
    try {
      const res = await importExportApi.importVolunteers(file);
      const volunteersRes = await volunteersApi.getAll();
      const skillsRes = await skillsApi.getAll();
      set({
        volunteers: volunteersRes.data,
        skills: skillsRes.data,
        loading: false,
      });
      return res.data;
    } catch (error) {
      set({
        loading: false,
        error: error.response?.data?.error || error.message,
      });
      throw error;
    }
  },

  addDateRequirement: async (dateId, data) => {
    try {
      const res = await eventDatesApi.addRequirement(dateId, data);
      return res.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useStore;
