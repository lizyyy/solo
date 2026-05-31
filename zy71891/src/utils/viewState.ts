import { ViewState, FilterOptions } from '../types';

const VIEW_STATE_STORAGE_KEY = 'cold_storage_view_state';

const defaultViewState: ViewState = {
  page: 'overview',
  filters: {},
  scrollTop: 0,
  expandedIds: [],
  chartRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
};

export function saveViewState(page: string, state: Partial<ViewState>): void {
  try {
    const currentState = getViewState(page);
    const newState: ViewState = {
      ...defaultViewState,
      ...currentState,
      ...state,
      page,
    };
    
    const allStates = getAllViewStates();
    allStates[page] = newState;
    
    localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(allStates));
  } catch (e) {
    console.error('Failed to save view state:', e);
  }
}

export function getViewState(page: string): ViewState {
  try {
    const allStates = getAllViewStates();
    return allStates[page] || { ...defaultViewState, page };
  } catch {
    return { ...defaultViewState, page };
  }
}

export function saveScrollPosition(page: string, scrollTop: number): void {
  saveViewState(page, { scrollTop });
}

export function getScrollPosition(page: string): number {
  return getViewState(page).scrollTop;
}

export function saveFilters(page: string, filters: FilterOptions): void {
  saveViewState(page, { filters });
}

export function getFilters(page: string): FilterOptions {
  return getViewState(page).filters as FilterOptions;
}

export function saveExpandedIds(page: string, expandedIds: string[]): void {
  saveViewState(page, { expandedIds });
}

export function getExpandedIds(page: string): string[] {
  return getViewState(page).expandedIds;
}

export function saveChartRange(page: string, start: string, end: string): void {
  saveViewState(page, { chartRange: { start, end } });
}

export function getChartRange(page: string): { start: string; end: string } {
  return getViewState(page).chartRange;
}

export function clearViewState(page?: string): void {
  try {
    if (page) {
      const allStates = getAllViewStates();
      delete allStates[page];
      localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(allStates));
    } else {
      localStorage.removeItem(VIEW_STATE_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to clear view state:', e);
  }
}

function getAllViewStates(): Record<string, ViewState> {
  try {
    const data = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function getExportRange(page: string): { start: string; end: string } {
  return getChartRange(page);
}

export function getExportFilters(page: string): FilterOptions {
  return getFilters(page);
}
