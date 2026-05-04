export type KeyType = number | string;
export type ValueType = Record<string, unknown>;

export interface IndexStats {
  pageAccesses: number;
  bucketConflicts: number;
  tableLookups: number;
  estimatedTime: number;
}

export interface OperationResult {
  success: boolean;
  key?: KeyType;
  value?: ValueType;
  stats: IndexStats;
  steps: OperationStep[];
  message?: string;
}

export interface OperationStep {
  type: 'read' | 'write' | 'split' | 'merge' | 'rebalance' | 'conflict' | 'resize' | 'lookup';
  pageId?: number;
  bucketId?: number;
  description: string;
  timestamp: number;
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string;
}

export interface ColumnDefinition {
  name: string;
  type: 'number' | 'string' | 'boolean';
  nullable?: boolean;
}

export interface IndexDefinition {
  name: string;
  type: 'bplus' | 'hash';
  table: string;
  columns: string[];
  isUnique?: boolean;
  order?: 'asc' | 'desc';
}

export interface QuerySample {
  id: string;
  name: string;
  type: 'equality' | 'range' | 'prefix' | 'insert' | 'delete' | 'update';
  table: string;
  index?: string;
  conditions: QueryCondition[];
  values?: Record<string, unknown>;
  expectedRows?: number;
  description?: string;
}

export interface QueryCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
  value: unknown;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  seed: number;
  tables: TableSchema[];
  indexes: IndexDefinition[];
  queries: QuerySample[];
  dataSize: number;
  bplusOrder: number;
  hashLoadFactor: number;
  hashInitialBuckets: number;
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  timestamp: number;
  queryResults: QueryResult[];
  comparison: IndexComparison;
}

export interface QueryResult {
  queryId: string;
  queryName: string;
  queryType: string;
  bplusResult: OperationResult;
  hashResult: OperationResult;
  winner: 'bplus' | 'hash' | 'tie';
}

export interface IndexComparison {
  bplus: {
    totalPageAccesses: number;
    totalTime: number;
    queriesWon: number;
    strengths: string[];
    weaknesses: string[];
    bestScenarios: string[];
  };
  hash: {
    totalPageAccesses: number;
    totalTime: number;
    queriesWon: number;
    strengths: string[];
    weaknesses: string[];
    bestScenarios: string[];
  };
  overallWinner: 'bplus' | 'hash' | 'tie';
  recommendations: string[];
}

export interface BPlusTreeVisualization {
  root: BPlusTreeNodeVisual;
  height: number;
  order: number;
  leafCount: number;
  internalNodeCount: number;
}

export interface BPlusTreeNodeVisual {
  id: string;
  keys: KeyType[];
  isLeaf: boolean;
  level: number;
  children?: string[];
  nextLeaf?: string;
  prevLeaf?: string;
}

export interface HashVisualization {
  buckets: HashBucketVisual[];
  loadFactor: number;
  bucketCount: number;
  entryCount: number;
  maxChainLength: number;
  avgChainLength: number;
}

export interface HashBucketVisual {
  id: number;
  entries: HashEntryVisual[];
  chainLength: number;
  isOverflow: boolean;
}

export interface HashEntryVisual {
  key: KeyType;
  valuePointer: number;
  hash: number;
}

export interface SavedExperiment {
  id: string;
  name: string;
  createdAt: number;
  config: ExperimentConfig;
  result?: ExperimentResult;
}

export interface AppState {
  currentExperiment: ExperimentConfig | null;
  currentResult: ExperimentResult | null;
  savedExperiments: SavedExperiment[];
  bplusVisualization: BPlusTreeVisualization | null;
  hashVisualization: HashVisualization | null;
  isLoading: boolean;
  error: string | null;
  activeTab: 'config' | 'visualization' | 'results' | 'comparison';
}
