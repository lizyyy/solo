import { TableRow, TableState, FilterCondition, SortConfig, GroupConfig } from '../types';

export interface FilterResult {
  rows: TableRow[];
  errors: string[];
  groupedData?: Record<string, TableRow[]>;
}

export function applyTableState(data: TableRow[], state: TableState): FilterResult {
  const errors: string[] = [];
  let rows = [...data];

  if (state.searchText) {
    rows = applySearch(rows, state.searchText);
  }

  for (const filter of state.filters) {
    try {
      rows = applyFilter(rows, filter);
    } catch (e) {
      errors.push(`筛选条件 [${filter.field}:${filter.operator}] 执行失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (state.sort) {
    try {
      rows = applySort(rows, state.sort);
    } catch (e) {
      errors.push(`排序 [${state.sort.field}] 执行失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let groupedData: Record<string, TableRow[]> | undefined;
  if (state.groupBy) {
    try {
      groupedData = applyGroup(rows, state.groupBy);
    } catch (e) {
      errors.push(`分组 [${state.groupBy.field}] 执行失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const { page, pageSize } = state.pagination;
  const start = (page - 1) * pageSize;
  rows = rows.slice(start, start + pageSize);

  return { rows, errors, groupedData };
}

function applySearch(rows: TableRow[], searchText: string): TableRow[] {
  const lowerText = searchText.toLowerCase();
  return rows.filter(row => {
    return Object.values(row).some(value => {
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(lowerText);
    });
  });
}

function applyFilter(rows: TableRow[], filter: FilterCondition): TableRow[] {
  const { field, operator, value } = filter;

  return rows.filter(row => {
    const rowValue = row[field];
    return evaluateCondition(rowValue, operator, value);
  });
}

function evaluateCondition(
  rowValue: unknown,
  operator: FilterCondition['operator'],
  filterValue: unknown
): boolean {
  if (rowValue === null || rowValue === undefined) {
    return false;
  }

  const rowStr = String(rowValue);
  const rowNum = Number(rowValue);
  const isRowNumber = !Number.isNaN(rowNum);

  switch (operator) {
    case 'equals': {
      return rowValue === filterValue || rowStr === String(filterValue);
    }
    case 'contains': {
      const filterStr = String(filterValue).toLowerCase();
      return rowStr.toLowerCase().includes(filterStr);
    }
    case 'startsWith': {
      const filterStr = String(filterValue).toLowerCase();
      return rowStr.toLowerCase().startsWith(filterStr);
    }
    case 'endsWith': {
      const filterStr = String(filterValue).toLowerCase();
      return rowStr.toLowerCase().endsWith(filterStr);
    }
    case 'greaterThan': {
      if (!isRowNumber) return false;
      const filterNum = Number(filterValue);
      if (Number.isNaN(filterNum)) return false;
      return rowNum > filterNum;
    }
    case 'lessThan': {
      if (!isRowNumber) return false;
      const filterNum = Number(filterValue);
      if (Number.isNaN(filterNum)) return false;
      return rowNum < filterNum;
    }
    case 'in': {
      if (!Array.isArray(filterValue)) return false;
      return filterValue.some(v => String(v) === rowStr);
    }
    case 'between': {
      if (!Array.isArray(filterValue) || filterValue.length < 2) return false;
      if (!isRowNumber) return false;
      const [min, max] = filterValue;
      const minNum = Number(min);
      const maxNum = Number(max);
      if (Number.isNaN(minNum) || Number.isNaN(maxNum)) return false;
      return rowNum >= minNum && rowNum <= maxNum;
    }
    default:
      return false;
  }
}

function applySort(rows: TableRow[], sort: SortConfig): TableRow[] {
  const { field, direction } = sort;
  
  return [...rows].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    const areNumbers = !Number.isNaN(aNum) && !Number.isNaN(bNum);
    
    let comparison: number;
    if (areNumbers) {
      comparison = aNum - bNum;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
}

function applyGroup(rows: TableRow[], group: GroupConfig): Record<string, TableRow[]> {
  const groups: Record<string, TableRow[]> = {};
  
  for (const row of rows) {
    const key = String(row[group.field] ?? '未分组');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }
  
  return groups;
}

export function validateFilterValue(_field: string, operator: string, value: unknown): { valid: boolean; error?: string } {
  if (operator === 'in' || operator === 'between') {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${operator} 操作符需要数组类型的值` };
    }
    if (operator === 'between' && value.length < 2) {
      return { valid: false, error: 'between 操作符需要至少两个值' };
    }
  }
  
  if (operator === 'greaterThan' || operator === 'lessThan' || operator === 'between') {
    if (Array.isArray(value)) {
      for (const v of value) {
        const num = Number(v);
        if (Number.isNaN(num)) {
          return { valid: false, error: `数值操作符需要数值类型的值` };
        }
      }
    } else {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return { valid: false, error: `数值操作符需要数值类型的值` };
      }
    }
  }
  
  return { valid: true };
}
