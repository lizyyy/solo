import { create } from 'zustand';
import type { PortfolioState, PortfolioActions, FilterCriteria, StudentWork, PortfolioScore } from '../types';
import { mockWorks } from '../data/mockWorks';
import { calculatePortfolioScore, detectAnomalies } from '../utils/scoring';
import {
  loadWorks, saveWorks, loadSessions, saveSessions, loadCriteria, saveCriteria,
  loadSelectedIds, saveSelectedIds, createSession
} from '../utils/storage';

const defaultCriteria: FilterCriteria = {
  tags: [],
  mediums: [],
  minCompletion: 1,
  applicationDirection: null
};

function getInitialState(): PortfolioState {
  const storedWorks = loadWorks();
  const storedCriteria = loadCriteria();
  const storedSelected = loadSelectedIds();
  const storedSessions = loadSessions();

  const works = storedWorks.length > 0 ? storedWorks : mockWorks;
  const criteria = storedCriteria || defaultCriteria;
  const selectedWorkIds = storedSelected;

  const filteredWorks = works.filter(work => {
    if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) return false;
    if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) return false;
    if (work.completion < criteria.minCompletion) return false;
    if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) return false;
    return true;
  });

  const selectedWorks = filteredWorks.filter(w => selectedWorkIds.includes(w.id));
  const currentScore = selectedWorks.length > 0
    ? calculatePortfolioScore(selectedWorks, criteria)
    : null;

  const anomalies = selectedWorks.length > 0
    ? detectAnomalies(selectedWorks)
    : [];

  return {
    works,
    selectedWorkIds,
    filterCriteria: criteria,
    anomalies,
    sessions: storedSessions,
    currentScore
  };
}

export const usePortfolioStore = create<PortfolioState & PortfolioActions>((set, get) => ({
  ...getInitialState(),

  setWorks: (works: StudentWork[]) => {
    saveWorks(works);
    const state = get();
    const criteria = state.filterCriteria;
    const filteredWorks = works.filter(work => {
      if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) return false;
      if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) return false;
      if (work.completion < criteria.minCompletion) return false;
      if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) return false;
      return true;
    });
    const selectedWorks = filteredWorks.filter(w => state.selectedWorkIds.includes(w.id));
    const currentScore = selectedWorks.length > 0
      ? calculatePortfolioScore(selectedWorks, criteria)
      : null;
    const anomalies = selectedWorks.length > 0
      ? detectAnomalies(selectedWorks)
      : [];
    set({ works, currentScore, anomalies });
  },

  setFilterCriteria: (newCriteria: Partial<FilterCriteria>) => {
    const state = get();
    const criteria = { ...state.filterCriteria, ...newCriteria };
    saveCriteria(criteria);

    const filteredWorks = state.works.filter(work => {
      if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) return false;
      if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) return false;
      if (work.completion < criteria.minCompletion) return false;
      if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) return false;
      return true;
    });

    const validSelectedIds = state.selectedWorkIds.filter(id =>
      filteredWorks.some(w => w.id === id)
    );
    saveSelectedIds(validSelectedIds);

    const selectedWorks = filteredWorks.filter(w => validSelectedIds.includes(w.id));
    const currentScore = selectedWorks.length > 0
      ? calculatePortfolioScore(selectedWorks, criteria)
      : null;
    const anomalies = selectedWorks.length > 0
      ? detectAnomalies(selectedWorks)
      : [];

    set({
      filterCriteria: criteria,
      selectedWorkIds: validSelectedIds,
      currentScore,
      anomalies
    });
  },

  toggleWorkSelection: (workId: string) => {
    const state = get();
    let newSelectedIds: string[];
    if (state.selectedWorkIds.includes(workId)) {
      newSelectedIds = state.selectedWorkIds.filter(id => id !== workId);
    } else {
      newSelectedIds = [...state.selectedWorkIds, workId];
    }
    saveSelectedIds(newSelectedIds);

    const selectedWorks = state.works.filter(w => newSelectedIds.includes(w.id));
    const currentScore = selectedWorks.length > 0
      ? calculatePortfolioScore(selectedWorks, state.filterCriteria)
      : null;
    const anomalies = selectedWorks.length > 0
      ? detectAnomalies(selectedWorks)
      : [];

    set({
      selectedWorkIds: newSelectedIds,
      currentScore,
      anomalies
    });
  },

  selectAllFiltered: () => {
    const state = get();
    const criteria = state.filterCriteria;
    const filteredWorks = state.works.filter(work => {
      if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) return false;
      if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) return false;
      if (work.completion < criteria.minCompletion) return false;
      if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) return false;
      return true;
    });
    const newSelectedIds = filteredWorks.map(w => w.id);
    saveSelectedIds(newSelectedIds);

    const currentScore = filteredWorks.length > 0
      ? calculatePortfolioScore(filteredWorks, criteria)
      : null;
    const anomalies = filteredWorks.length > 0
      ? detectAnomalies(filteredWorks)
      : [];

    set({
      selectedWorkIds: newSelectedIds,
      currentScore,
      anomalies
    });
  },

  clearSelection: () => {
    saveSelectedIds([]);
    set({
      selectedWorkIds: [],
      currentScore: null,
      anomalies: []
    });
  },

  calculateScore: () => {
    const state = get();
    const selectedWorks = state.works.filter(w => state.selectedWorkIds.includes(w.id));
    const score = calculatePortfolioScore(selectedWorks, state.filterCriteria);
    set({ currentScore: score });
  },

  detectAnomalies: () => {
    const state = get();
    const selectedWorks = state.works.filter(w => state.selectedWorkIds.includes(w.id));
    const anomalies = detectAnomalies(selectedWorks);
    set({ anomalies });
  },

  saveSession: (name: string, note: string) => {
    const state = get();
    if (!state.currentScore) return;

    const session = createSession(
      name,
      note,
      state.filterCriteria,
      state.selectedWorkIds,
      state.currentScore,
      state.anomalies
    );

    const sessions = [session, ...state.sessions];
    saveSessions(sessions);
    set({ sessions });
  },

  loadSession: (sessionId: string) => {
    const state = get();
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;
    get().resetToSession(session);
  },

  deleteSession: (sessionId: string) => {
    const state = get();
    const sessions = state.sessions.filter(s => s.id !== sessionId);
    saveSessions(sessions);
    set({ sessions });
  },

  resetToSession: (session) => {
    saveCriteria(session.criteria);
    saveSelectedIds(session.selectedWorkIds);

    const selectedWorks = get().works.filter(w => session.selectedWorkIds.includes(w.id));
    const score = calculatePortfolioScore(selectedWorks, session.criteria);
    const anomalies = detectAnomalies(selectedWorks);

    set({
      filterCriteria: session.criteria,
      selectedWorkIds: session.selectedWorkIds,
      currentScore: score,
      anomalies
    });
  }
}));

export function useFilteredWorks(): StudentWork[] {
  const works = usePortfolioStore(s => s.works);
  const criteria = usePortfolioStore(s => s.filterCriteria);

  return works.filter(work => {
    if (criteria.tags.length > 0 && !criteria.tags.some(t => work.tags.includes(t))) return false;
    if (criteria.mediums.length > 0 && !criteria.mediums.some(m => work.mediums.includes(m))) return false;
    if (work.completion < criteria.minCompletion) return false;
    if (criteria.applicationDirection && !work.applicationDirection.includes(criteria.applicationDirection)) return false;
    return true;
  });
}

export function useSelectedWorks(): StudentWork[] {
  const works = usePortfolioStore(s => s.works);
  const selectedIds = usePortfolioStore(s => s.selectedWorkIds);
  return works.filter(w => selectedIds.includes(w.id));
}

export function useHasAnomalyWorks(workId: string): boolean {
  const anomalies = usePortfolioStore(s => s.anomalies);
  return anomalies.some(a => a.relatedWorkIds.includes(workId));
}
