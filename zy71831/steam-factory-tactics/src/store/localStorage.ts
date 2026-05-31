import { BattleReport, HistorySnapshot, FilterCondition } from '../types';

const REPORTS_KEY = 'sft_reports';
const HISTORY_KEY = 'sft_history';
const STATE_KEY = 'sft_state';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getAllReports(): BattleReport[] {
  return read<BattleReport[]>(REPORTS_KEY, []);
}

export function getReportById(id: string): BattleReport | undefined {
  return getAllReports().find(r => r.id === id);
}

export function saveReport(report: BattleReport): BattleReport {
  const reports = getAllReports();
  const idx = reports.findIndex(r => r.id === report.id);
  if (idx >= 0) {
    reports[idx] = { ...report, version: reports[idx].version + 1 };
  } else {
    reports.push({ ...report, id: report.id || genId(), version: 1 });
  }
  write(REPORTS_KEY, reports);
  return reports[idx >= 0 ? idx : reports.length - 1];
}

export function deleteReport(id: string): void {
  const reports = getAllReports().filter(r => r.id !== id);
  write(REPORTS_KEY, reports);
}

export function addHistory(action: HistorySnapshot['action'], summary: string, data: BattleReport): void {
  const history = getAllHistory();
  history.unshift({
    id: genId(),
    reportId: data.id,
    timestamp: Date.now(),
    action,
    summary,
    data: structuredClone(data),
  });
  if (history.length > 200) history.length = 200;
  write(HISTORY_KEY, history);
}

export function getAllHistory(): HistorySnapshot[] {
  return read<HistorySnapshot[]>(HISTORY_KEY, []);
}

export function filterReports(reports: BattleReport[], filter: FilterCondition): BattleReport[] {
  return reports.filter(r => {
    if (filter.faction && filter.faction !== 'all') {
      if (!r.units.some(u => u.faction === filter.faction)) return false;
    }
    if (filter.scenarioName) {
      if (!r.scenarioName.includes(filter.scenarioName)) return false;
    }
    if (filter.dateFrom && r.createdAt < filter.dateFrom) return false;
    if (filter.dateTo && r.createdAt > filter.dateTo) return false;
    if (filter.corrected !== undefined && r.corrected !== filter.corrected) return false;
    return true;
  });
}

export function saveAppState(state: { currentReportId: string | null; currentFilter: FilterCondition; activePanel: string }): void {
  write(STATE_KEY, state);
}

export function loadAppState(): { currentReportId: string | null; currentFilter: FilterCondition; activePanel: string } | null {
  return read<{
    currentReportId: string | null;
    currentFilter: FilterCondition;
    activePanel: string;
  } | null>(STATE_KEY, null);
}

export { genId };
