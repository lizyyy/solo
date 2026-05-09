import { create } from 'zustand';
import { Event, Registration } from '@/types';
import { api } from '@/lib/api';

interface AppState {
  events: Event[];
  currentEvent: Event | null;
  registrations: Registration[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  fetchEvents: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) => Promise<void>;
  fetchEvent: (id: string) => Promise<void>;
  createEvent: (dto: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    maxParticipants: number;
  }) => Promise<Event | null>;
  updateEvent: (
    id: string,
    dto: {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
      maxParticipants?: number;
      status?: 'draft' | 'active' | 'cancelled';
    }
  ) => Promise<Event | null>;
  fetchEventRegistrations: (eventId: string) => Promise<void>;
  createRegistration: (dto: {
    eventId: string;
    userName: string;
    userEmail: string;
    userPhone?: string;
    notes?: string;
  }) => Promise<Registration | null>;
  cancelRegistration: (
    id: string,
    version: number
  ) => Promise<Registration | null>;
  setError: (error: string | null) => void;
  clearCurrentEvent: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  currentEvent: null,
  registrations: [],
  isLoading: false,
  error: null,
  currentUserId: 'user-001',

  setCurrentUserId: (id: string) => set({ currentUserId: id }),

  fetchEvents: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getEvents(params);
      set({ events: result.items, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  fetchEvent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const event = await api.getEvent(id);
      set({ currentEvent: event, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  createEvent: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const idempotencyToken = api.generateIdempotencyToken();
      const event = await api.createEvent(dto, idempotencyToken);
      set((state) => ({
        events: [event, ...state.events],
        isLoading: false,
      }));
      return event;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      return null;
    }
  },

  updateEvent: async (id, dto) => {
    set({ isLoading: true, error: null });
    try {
      const currentEvent = get().currentEvent;
      if (!currentEvent) {
        throw new Error('No current event');
      }

      const updatedEvent = await api.updateEvent(id, dto, currentEvent.version);
      set((state) => ({
        currentEvent: updatedEvent,
        events: state.events.map((e) =>
          e.id === id ? updatedEvent : e
        ),
        isLoading: false,
      }));
      return updatedEvent;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      return null;
    }
  },

  fetchEventRegistrations: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getEventRegistrations(eventId);
      set({ registrations: result.items, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  createRegistration: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const idempotencyToken = api.generateIdempotencyToken();
      const currentUserId = get().currentUserId;
      const registration = await api.createRegistration(
        {
          ...dto,
          userId: currentUserId,
        },
        idempotencyToken
      );

      const currentEvent = get().currentEvent;
      if (currentEvent && currentEvent.id === dto.eventId) {
        const updatedEvent = await api.getEvent(dto.eventId);
        set({ currentEvent: updatedEvent });
      }

      set((state) => ({
        registrations: [registration, ...state.registrations],
        isLoading: false,
      }));
      return registration;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      return null;
    }
  },

  cancelRegistration: async (id: string, version: number) => {
    set({ isLoading: true, error: null });
    try {
      const registration = await api.cancelRegistration(id, version);
      set((state) => ({
        registrations: state.registrations.map((r) =>
          r.id === id ? registration : r
        ),
        isLoading: false,
      }));
      return registration;
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
      return null;
    }
  },

  setError: (error: string | null) => set({ error }),

  clearCurrentEvent: () => set({ currentEvent: null, registrations: [] }),
}));
