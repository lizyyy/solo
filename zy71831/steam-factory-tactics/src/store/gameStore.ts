import { BattleReport, AppState, FilterCondition } from '../types';
import { getAllReports, getReportById, saveReport, filterReports, loadAppState, saveAppState as persistState } from './localStorage';

type Listener = () => void;

const listeners: Listener[] = [];

let state: AppState = {
  currentReport: null,
  currentFilter: {},
  batchJob: null,
  activePanel: 'import',
};

export function initStore(): void {
  const saved = loadAppState();
  if (saved) {
    state.currentFilter = saved.currentFilter || {};
    state.activePanel = (saved.activePanel as AppState['activePanel']) || 'import';
    if (saved.currentReportId) {
      state.currentReport = getReportById(saved.currentReportId) || null;
    }
  }
}

export function getState(): AppState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(): void {
  persistState({
    currentReportId: state.currentReport?.id || null,
    currentFilter: state.currentFilter,
    activePanel: state.activePanel,
  });
  listeners.forEach(fn => fn());
}

export function setCurrentReport(report: BattleReport | null): void {
  state = { ...state, currentReport: report };
  notify();
}

export function setFilter(filter: FilterCondition): void {
  state = { ...state, currentFilter: filter };
  notify();
}

export function setActivePanel(panel: AppState['activePanel']): void {
  state = { ...state, activePanel: panel };
  notify();
}

export function setBatchJob(job: AppState['batchJob']): void {
  state = { ...state, batchJob: job };
  notify();
}

export function getFilteredReports(): BattleReport[] {
  return filterReports(getAllReports(), state.currentFilter);
}

export function upsertReport(report: BattleReport): BattleReport {
  const saved = saveReport(report);
  if (state.currentReport?.id === saved.id) {
    state = { ...state, currentReport: saved };
    notify();
  }
  return saved;
}
