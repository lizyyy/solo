export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'in' | 'between';
  value: string | number | boolean | (string | number)[];
}

export interface GroupConfig {
  field: string;
}

export interface TableState {
  searchText: string;
  filters: FilterCondition[];
  sort: SortConfig | null;
  groupBy: GroupConfig | null;
  selectedIds: string[];
  pagination: {
    page: number;
    pageSize: number;
  };
}

export interface TableRow {
  id: string;
  [key: string]: string | number | boolean | object;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  state: TableState;
  label?: string;
}

export interface ReplayCommand {
  id: string;
  name: string;
  state: TableState;
  createdAt: number;
  isExecuted: boolean;
  executedAt?: number;
  result?: ReplayResult;
}

export interface ReplayResult {
  success: boolean;
  message: string;
  errors: string[];
  matchedRows: number;
  timestamp: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

export interface ExportReport {
  commandId: string;
  commandName: string;
  executedAt: number;
  originalState: TableState;
  result: ReplayResult;
  filteredData: TableRow[];
  metadata: {
    version: string;
    generatedAt: number;
  };
}
