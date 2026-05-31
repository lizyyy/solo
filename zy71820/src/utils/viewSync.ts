import { putRecord, getFromIndex } from './idb';
import { generateId } from './helpers';
import type { ViewState } from '../types/data';

const DEFAULT_VIEW_STATE: Omit<ViewState, 'id' | 'page'> = {
  filters: {},
  viewport: {
    scrollTop: 0,
    scrollLeft: 0,
    selectedColumns: ['playerName', 'score', 'status', 'createdAt'],
  },
};

export async function saveViewState(
  page: string,
  filtersOrState: Partial<ViewState> | ViewState['filters'],
  viewport?: ViewState['viewport']
): Promise<void> {
  const existing = await getViewState(page);
  
  let state: Partial<ViewState>;
  if (viewport !== undefined) {
    state = {
      filters: filtersOrState as ViewState['filters'],
      viewport,
    };
  } else {
    state = filtersOrState as Partial<ViewState>;
  }

  const viewState: ViewState = {
    id: existing?.id || generateId(),
    page,
    filters: { ...existing?.filters, ...state.filters },
    viewport: { ...existing?.viewport, ...state.viewport },
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await putRecord('view_state', viewState);
}

export async function getViewState(page: string): Promise<ViewState | undefined> {
  const results = await getFromIndex('view_state', 'by-page', page);
  return results[0];
}

export async function loadViewState(page: string): Promise<ViewState | undefined> {
  return getViewState(page);
}

export async function restoreViewState(page: string): Promise<ViewState> {
  const saved = await getViewState(page);
  if (saved) {
    return saved;
  }
  return {
    id: generateId(),
    page,
    ...DEFAULT_VIEW_STATE,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function syncExportRange(page: string): Promise<ViewState['filters']> {
  const state = await getViewState(page);
  return state?.filters || {};
}

export function debouncedSaveViewState(
  page: string,
  state: Partial<ViewState>
): void {
  clearTimeout((debouncedSaveViewState as any)._timeout);
  (debouncedSaveViewState as any)._timeout = setTimeout(() => {
    saveViewState(page, state);
  }, 500);
}

export function serializeFilters(filters: ViewState['filters']): string {
  const parts: string[] = [];
  if (filters.timeRange) {
    parts.push(`time:${filters.timeRange[0]}-${filters.timeRange[1]}`);
  }
  if (filters.levelId) {
    parts.push(`level:${filters.levelId}`);
  }
  if (filters.playerName) {
    parts.push(`player:${filters.playerName}`);
  }
  if (filters.status?.length) {
    parts.push(`status:${filters.status.join(',')}`);
  }
  return parts.join('|');
}

export function generateExportFilename(page: string, filters: ViewState['filters']): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filterStr = serializeFilters(filters).replace(/[:|,]/g, '-');
  return `夜市经营赛_${page}_${timestamp}${filterStr ? '_' + filterStr : ''}.json`;
}
