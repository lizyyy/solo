import { TableState, ValidationError } from '../types';

const URL_PARAM = 't';

export function encodeTableState(state: TableState): string {
  const cleaned = cleanupState(state);
  const json = JSON.stringify(cleaned);
  return btoa(encodeURIComponent(json));
}

export function decodeTableState(encoded: string): { state: TableState; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    return validateAndNormalizeState(parsed, errors);
  } catch (e) {
    errors.push({
      field: 'encoded',
      message: `URL 状态解码失败: ${e instanceof Error ? e.message : String(e)}`,
      value: encoded,
    });
    return { state: getDefaultState(), errors };
  }
}

export function getStateFromURL(): { state: TableState; errors: ValidationError[] } {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(URL_PARAM);
  
  if (!encoded) {
    return { state: getDefaultState(), errors: [] };
  }
  
  return decodeTableState(encoded);
}

export function setStateToURL(state: TableState): string {
  const encoded = encodeTableState(state);
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, encoded);
  const newURL = url.toString();
  window.history.replaceState({}, '', newURL);
  return newURL;
}

export function clearURLState(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(URL_PARAM);
  window.history.replaceState({}, '', url.toString());
}

function validateAndNormalizeState(
  parsed: unknown,
  errors: ValidationError[]
): { state: TableState; errors: ValidationError[] } {
  if (typeof parsed !== 'object' || parsed === null) {
    errors.push({
      field: 'root',
      message: '状态必须是对象',
      value: parsed,
    });
    return { state: getDefaultState(), errors };
  }

  const obj = parsed as Record<string, unknown>;
  const defaultState = getDefaultState();
  const state: TableState = { ...defaultState };

  if (typeof obj.searchText === 'string') {
    state.searchText = obj.searchText;
  } else if (obj.searchText !== undefined) {
    errors.push({
      field: 'searchText',
      message: 'searchText 必须是字符串',
      value: obj.searchText,
    });
  }

  if (Array.isArray(obj.filters)) {
    const validFilters = [];
    for (let i = 0; i < obj.filters.length; i++) {
      const filter = obj.filters[i];
      if (isValidFilterCondition(filter)) {
        validFilters.push(filter);
      } else {
        errors.push({
          field: `filters[${i}]`,
          message: '无效的筛选条件',
          value: filter,
        });
      }
    }
    state.filters = validFilters;
  } else if (obj.filters !== undefined) {
    errors.push({
      field: 'filters',
      message: 'filters 必须是数组',
      value: obj.filters,
    });
  }

  if (obj.sort === null) {
    state.sort = null;
  } else if (isValidSortConfig(obj.sort)) {
    state.sort = obj.sort;
  } else if (obj.sort !== undefined) {
    errors.push({
      field: 'sort',
      message: '无效的排序配置',
      value: obj.sort,
    });
  }

  if (obj.groupBy === null) {
    state.groupBy = null;
  } else if (isValidGroupConfig(obj.groupBy)) {
    state.groupBy = obj.groupBy;
  } else if (obj.groupBy !== undefined) {
    errors.push({
      field: 'groupBy',
      message: '无效的分组配置',
      value: obj.groupBy,
    });
  }

  if (Array.isArray(obj.selectedIds)) {
    const validIds: string[] = [];
    for (let i = 0; i < obj.selectedIds.length; i++) {
      const id = obj.selectedIds[i];
      if (typeof id === 'string') {
        validIds.push(id);
      } else {
        errors.push({
          field: `selectedIds[${i}]`,
          message: '选中的 ID 必须是字符串',
          value: id,
        });
      }
    }
    state.selectedIds = validIds;
  } else if (obj.selectedIds !== undefined) {
    errors.push({
      field: 'selectedIds',
      message: 'selectedIds 必须是数组',
      value: obj.selectedIds,
    });
  }

  if (typeof obj.pagination === 'object' && obj.pagination !== null) {
    const pag = obj.pagination as Record<string, unknown>;
    if (typeof pag.page === 'number' && pag.page > 0) {
      state.pagination.page = Math.floor(pag.page);
    }
    if (typeof pag.pageSize === 'number' && pag.pageSize > 0) {
      state.pagination.pageSize = Math.floor(pag.pageSize);
    }
  }

  return { state, errors };
}

function isValidFilterCondition(value: unknown): value is import('../types').FilterCondition {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const validOps = ['equals', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan', 'in', 'between'];
  
  if (typeof obj.field !== 'string' || obj.field.length === 0) return false;
  if (typeof obj.operator !== 'string' || !validOps.includes(obj.operator)) return false;
  if (obj.value === undefined) return false;
  
  return true;
}

function isValidSortConfig(value: unknown): value is import('../types').SortConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.field === 'string' &&
    obj.field.length > 0 &&
    (obj.direction === 'asc' || obj.direction === 'desc')
  );
}

function isValidGroupConfig(value: unknown): value is import('../types').GroupConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.field === 'string' && obj.field.length > 0;
}

function cleanupState(state: TableState): TableState {
  return {
    searchText: state.searchText || '',
    filters: state.filters.filter(f => f.field && f.operator),
    sort: state.sort?.field ? state.sort : null,
    groupBy: state.groupBy?.field ? state.groupBy : null,
    selectedIds: state.selectedIds || [],
    pagination: {
      page: Math.max(1, state.pagination?.page || 1),
      pageSize: Math.max(1, state.pagination?.pageSize || 10),
    },
  };
}

export function getDefaultState(): TableState {
  return {
    searchText: '',
    filters: [],
    sort: null,
    groupBy: null,
    selectedIds: [],
    pagination: {
      page: 1,
      pageSize: 10,
    },
  };
}

export function statesEqual(a: TableState, b: TableState): boolean {
  return JSON.stringify(cleanupState(a)) === JSON.stringify(cleanupState(b));
}
