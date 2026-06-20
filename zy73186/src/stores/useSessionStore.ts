import { create } from 'zustand';
import type { Session, StoredSession } from '../types';
import { persistenceService } from '../services/persistence';
import { auditLogger } from '../services/auditLogger';

interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  loadAllSessions: () => Promise<void>;
  loadCurrentSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  loadFullSession: (sessionId: string) => Promise<StoredSession | null>;
  createSession: (title?: string) => Promise<Session>;
  updateSession: (updates: Partial<Session>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateCurrentStep: (step: number) => Promise<void>;
  setCurrentStep: (step: number) => Promise<void>;
  setSessionStatus: (status: Session['status']) => Promise<void>;
  updateSessionStatus: (status: Session['status']) => Promise<void>;
  updateProgress: (progress: Partial<Session['progress']>) => Promise<void>;
  saveFullSession: (data: StoredSession) => Promise<void>;
  getCurrentProgress: () => Promise<{ sessionId: string; step: number } | null>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await persistenceService.getAllSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllSessions: async () => {
    await get().loadSessions();
  },

  setCurrentSession: (session: Session | null) => {
    set({ currentSession: session });
  },

  loadCurrentSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await persistenceService.getSession(sessionId);
      if (session) {
        set({ currentSession: session, isLoading: false });
      } else {
        set({ error: '会话不存在', isLoading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadFullSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await persistenceService.getFullSession(sessionId);
      if (data) {
        set({ currentSession: data.session, isLoading: false });
      }
      return data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  createSession: async (title?: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await persistenceService.createNewSession(title);
      set((state) => ({
        currentSession: session,
        sessions: [session, ...state.sessions],
        isLoading: false,
      }));
      return session;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateSession: async (updates: Partial<Session>) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const updatedSession: Session = {
      ...currentSession,
      ...updates,
      updatedAt: Date.now(),
    };

    try {
      await persistenceService.saveSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      await persistenceService.deleteSession(sessionId);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateCurrentStep: async (step: number) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const updatedSession: Session = {
      ...currentSession,
      currentStep: step,
      progress: {
        ...currentSession.progress,
        currentStep: step,
      },
      updatedAt: Date.now(),
    };

    try {
      await persistenceService.saveSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setSessionStatus: async (status: Session['status']) => {
    await get().updateSession({ status });
  },

  updateSessionStatus: async (status: Session['status']) => {
    await get().updateSession({ status });
  },

  setCurrentStep: async (step: number) => {
    await get().updateCurrentStep(step);
  },

  updateProgress: async (progress: Partial<Session['progress']>) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const updatedSession: Session = {
      ...currentSession,
      progress: {
        ...currentSession.progress,
        ...progress,
      },
      updatedAt: Date.now(),
    };

    try {
      await persistenceService.saveSession(updatedSession);
      set({ currentSession: updatedSession });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  saveFullSession: async (data: StoredSession) => {
    set({ isLoading: true, error: null });
    try {
      await persistenceService.saveFullSession(data);
      set((state) => ({
        currentSession: data.session,
        sessions: state.sessions.map((s) =>
          s.id === data.session.id ? data.session : s
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  getCurrentProgress: async () => {
    try {
      return await persistenceService.getCurrentProgress();
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
